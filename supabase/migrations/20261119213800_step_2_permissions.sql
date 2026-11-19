create schema if not exists vega_private;
revoke all on schema vega_private from public;
grant usage on schema vega_private to authenticated;

-- Only a global staff role grants administrator access. The caller cannot
-- supply a user ID to either helper.
create function vega_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function vega_private.project_role(target_project uuid)
returns public.project_role language sql stable security definer set search_path = ''
as $$
  select case when vega_private.is_admin() then 'admin'::public.project_role else (
    select nullif(m.role, 'admin')
    from public.project_members as m
    join public.profiles as p on p.id = m.user_id
    where m.user_id = (select auth.uid()) and m.project_id = target_project
  ) end;
$$;

revoke all on function vega_private.is_admin(), vega_private.project_role(uuid) from public;
grant execute on function vega_private.is_admin(), vega_private.project_role(uuid) to authenticated;

alter table public.projects
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists starts_on date,
  add column if not exists ends_on date;
alter table public.halls add column if not exists sort_order integer not null default 0;
alter table public.booths
  add column if not exists x numeric default 0,
  add column if not exists y numeric default 0,
  add column if not exists width numeric default 1,
  add column if not exists height numeric default 1;

create table public.exhibitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact_email text
);

create table public.finance_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount numeric(14,2) not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$')
);

create table public.project_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null
);

create index on public.exhibitors(project_id);
create index on public.finance_records(project_id);
create index on public.project_reports(project_id);
create index if not exists vega_project_members_user_idx on public.project_members(user_id, project_id);
create index if not exists vega_halls_project_idx on public.halls(project_id);
create index if not exists vega_booths_hall_idx on public.booths(hall_id);

-- Replace older permissive policies on the resources governed by Step 2.
do $$
declare
  relation text;
  legacy_policy record;
begin
  foreach relation in array array[
    'profiles', 'projects', 'project_members', 'halls', 'booths',
    'exhibitors', 'finance_records', 'project_reports'
  ] loop
    execute format('alter table public.%I enable row level security', relation);
    for legacy_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = relation
    loop
      execute format('drop policy %I on public.%I', legacy_policy.policyname, relation);
    end loop;
    execute format('revoke all on public.%I from public, anon, authenticated', relation);
    execute format('grant select, insert, delete on public.%I to authenticated', relation);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select vega_private.is_admin()))', relation);
  end loop;
end;
$$;

-- Keep identities and parent links immutable through the Data API.
grant update (full_name, role) on public.profiles to authenticated;
grant update (role) on public.project_members to authenticated;
grant update (code, name, status, default_currency, city, country, starts_on, ends_on) on public.projects to authenticated;
grant update (name, sort_order) on public.halls to authenticated;
grant update (code, x, y, width, height, status, exhibitor_name) on public.booths to authenticated;
grant update (name, contact_email) on public.exhibitors to authenticated;
grant update (description, amount, currency) on public.finance_records to authenticated;
grant update (title, body) on public.project_reports to authenticated;

create policy own_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select vega_private.is_admin()));
create policy admin_insert on public.profiles for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy admin_update on public.profiles for update to authenticated
  using ((select vega_private.is_admin())) with check ((select vega_private.is_admin()));

create policy own_or_admin on public.project_members for select to authenticated
  using (user_id = (select auth.uid()) or (select vega_private.is_admin()));
create policy admin_insert on public.project_members for insert to authenticated
  with check ((select vega_private.is_admin()) and role <> 'admin');
create policy admin_update on public.project_members for update to authenticated
  using ((select vega_private.is_admin()))
  with check ((select vega_private.is_admin()) and role <> 'admin');

create policy project_read on public.projects for select to authenticated
  using (vega_private.project_role(id) is not null);
create policy admin_insert on public.projects for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy project_update on public.projects for update to authenticated
  using (vega_private.project_role(id) in ('admin', 'project_director'))
  with check (vega_private.project_role(id) in ('admin', 'project_director'));

create policy hall_read on public.halls for select to authenticated
  using (vega_private.project_role(project_id) is not null);
create policy admin_insert on public.halls for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy hall_update on public.halls for update to authenticated
  using (vega_private.project_role(project_id) in ('admin', 'project_director', 'operations'))
  with check (vega_private.project_role(project_id) in ('admin', 'project_director', 'operations'));

create policy booth_read on public.booths for select to authenticated
  using (exists (select 1 from public.halls h where h.id = hall_id));
create policy admin_insert on public.booths for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy booth_update on public.booths for update to authenticated
  using (exists (
    select 1 from public.halls h where h.id = hall_id
    and vega_private.project_role(h.project_id) in ('admin', 'project_director', 'sales', 'operations')
  ))
  with check (exists (
    select 1 from public.halls h where h.id = hall_id
    and vega_private.project_role(h.project_id) in ('admin', 'project_director', 'sales', 'operations')
  ));

-- RLS scopes the row. The trigger checks transitions against the locked
-- current row, including when two staff try to reserve the same booth.
create function vega_private.check_booth_update()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  assigned_role public.project_role;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select vega_private.project_role(h.project_id) into assigned_role
  from public.halls h where h.id = old.hall_id;

  if assigned_role in ('admin', 'project_director') then
    return new;
  end if;

  if assigned_role = 'sales'
    and old.status = 'available' and new.status = 'reserved'
    and (new.code, new.x, new.y, new.width, new.height)
      is not distinct from (old.code, old.x, old.y, old.width, old.height)
  then
    return new;
  end if;

  if assigned_role = 'operations'
    and new.exhibitor_name is not distinct from old.exhibitor_name
    and (new.status = old.status or (
      old.status in ('available', 'blocked') and new.status in ('available', 'blocked')
    ))
  then
    return new;
  end if;

  raise exception 'This booth change is not allowed for your project role' using errcode = '42501';
end;
$$;

revoke all on function vega_private.check_booth_update() from public;
create trigger check_booth_update before update on public.booths
  for each row execute function vega_private.check_booth_update();

create policy exhibitor_read on public.exhibitors for select to authenticated
  using (vega_private.project_role(project_id) is not null);
create policy exhibitor_insert on public.exhibitors for insert to authenticated
  with check (vega_private.project_role(project_id) in ('admin', 'sales'));
create policy exhibitor_update on public.exhibitors for update to authenticated
  using (vega_private.project_role(project_id) in ('admin', 'project_director', 'sales'))
  with check (vega_private.project_role(project_id) in ('admin', 'project_director', 'sales'));

create policy finance_read on public.finance_records for select to authenticated
  using (vega_private.project_role(project_id) in ('admin', 'project_director'));
create policy admin_insert on public.finance_records for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy finance_update on public.finance_records for update to authenticated
  using (vega_private.project_role(project_id) in ('admin', 'project_director'))
  with check (vega_private.project_role(project_id) in ('admin', 'project_director'));

create policy report_read on public.project_reports for select to authenticated
  using (vega_private.project_role(project_id) in ('admin', 'project_director'));
create policy admin_insert on public.project_reports for insert to authenticated
  with check ((select vega_private.is_admin()));
create policy admin_update on public.project_reports for update to authenticated
  using ((select vega_private.is_admin())) with check ((select vega_private.is_admin()));

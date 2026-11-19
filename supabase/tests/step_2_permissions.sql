begin;

insert into auth.users (id) values
 ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'), ('10000000-0000-0000-0000-000000000004'),
 ('10000000-0000-0000-0000-000000000005'), ('10000000-0000-0000-0000-000000000006'),
 ('10000000-0000-0000-0000-000000000007');
insert into public.profiles (id, full_name, role) values
 ('10000000-0000-0000-0000-000000000001', 'Administrator', 'admin'),
 ('10000000-0000-0000-0000-000000000002', 'Director', 'viewer'),
 ('10000000-0000-0000-0000-000000000003', 'Sales', 'operations'),
 ('10000000-0000-0000-0000-000000000004', 'Operations', 'sales'),
 ('10000000-0000-0000-0000-000000000005', 'Viewer', 'project_director'),
 ('10000000-0000-0000-0000-000000000006', 'Unassigned', 'viewer')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
delete from public.profiles where id = '10000000-0000-0000-0000-000000000007';

insert into public.projects (id, code, name) values
 ('20000000-0000-0000-0000-000000000001', 'TEST-A', 'Assigned project'),
 ('20000000-0000-0000-0000-000000000002', 'TEST-B', 'Unassigned project');
insert into public.project_members values
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'project_director'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'sales'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'operations'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'viewer');
insert into public.halls (id, project_id, name) values
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Hall A'),
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Hall B');
insert into public.booths (hall_id, code) values
 ('30000000-0000-0000-0000-000000000001', 'TEST-ONE'),
 ('30000000-0000-0000-0000-000000000001', 'TEST-TWO'),
 ('30000000-0000-0000-0000-000000000002', 'TEST-THREE');
insert into public.exhibitors (project_id, name) values
 ('20000000-0000-0000-0000-000000000001', 'Exhibitor A'),
 ('20000000-0000-0000-0000-000000000002', 'Exhibitor B');
insert into public.finance_records (project_id, description, amount, currency) values
 ('20000000-0000-0000-0000-000000000001', 'Invoice A', 100, 'USD'),
 ('20000000-0000-0000-0000-000000000002', 'Invoice B', 200, 'USD');
insert into public.project_reports (project_id, title, body) values
 ('20000000-0000-0000-0000-000000000001', 'Report A', 'Assigned report'),
 ('20000000-0000-0000-0000-000000000002', 'Report B', 'Unassigned report');

create function pg_temp.expect_rows(statement text, expected bigint)
returns void language plpgsql as $$
declare observed bigint;
begin
  execute statement;
  get diagnostics observed = row_count;
  if observed <> expected then
    raise exception 'Expected % rows, got % from %', expected, observed, statement;
  end if;
end;
$$;

create function pg_temp.expect_denied(statement text)
returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected a permission denial for %', statement;
exception when insufficient_privilege then
  return;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_rows($$select id from public.projects where code like 'TEST-%'$$, 2);
select pg_temp.expect_rows($$select id from public.profiles where id::text like '10000000-%'$$, 6);
select pg_temp.expect_rows($$update public.profiles set role = 'sales' where full_name = 'Unassigned'$$, 1);
select pg_temp.expect_rows($$insert into public.project_members values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','sales')$$, 1);
select pg_temp.expect_rows($$delete from public.project_members where project_id = '20000000-0000-0000-0000-000000000002'$$, 1);
select pg_temp.expect_rows($$insert into public.projects (code,name) values ('TEST-C','Temporary')$$, 1);
select pg_temp.expect_rows($$delete from public.projects where code = 'TEST-C'$$, 1);
select pg_temp.expect_rows($$select id from public.finance_records where description like 'Invoice %'$$, 2);
select pg_temp.expect_rows($$update public.project_reports set body = 'Updated' where title = 'Report B'$$, 1);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_rows($$select id from public.projects where code like 'TEST-%'$$, 1);
select pg_temp.expect_rows($$update public.projects set name = 'Updated' where code like 'TEST-%'$$, 1);
select pg_temp.expect_rows($$update public.exhibitors set contact_email = 'test@example.invalid' where name like 'Exhibitor %'$$, 1);
select pg_temp.expect_rows($$update public.finance_records set amount = 110 where description like 'Invoice %'$$, 1);
select pg_temp.expect_rows($$select id from public.project_reports where title like 'Report %'$$, 1);
select pg_temp.expect_rows($$update public.project_reports set body = 'Forbidden' where title = 'Report A'$$, 0);
select pg_temp.expect_rows($$delete from public.exhibitors where name = 'Exhibitor A'$$, 0);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select pg_temp.expect_rows($$select id from public.halls where name in ('Hall A','Hall B')$$, 1);
select pg_temp.expect_rows($$select id from public.booths where code like 'TEST-%'$$, 2);
select pg_temp.expect_rows($$select id from public.finance_records$$, 0);
select pg_temp.expect_rows($$select id from public.project_reports$$, 0);
select pg_temp.expect_rows($$insert into public.exhibitors(project_id,name) values ('20000000-0000-0000-0000-000000000001','New exhibitor')$$, 1);
select pg_temp.expect_denied($$insert into public.exhibitors(project_id,name) values ('20000000-0000-0000-0000-000000000002','Wrong project')$$);
select pg_temp.expect_denied($$update public.booths set status = 'reserved', width = 20 where code = 'TEST-ONE'$$);
select pg_temp.expect_rows($$update public.booths set status = 'reserved', exhibitor_name = 'New exhibitor' where code = 'TEST-ONE'$$, 1);
select pg_temp.expect_denied($$update public.booths set exhibitor_name = 'Second reservation' where code = 'TEST-ONE'$$);
select pg_temp.expect_rows($$update public.booths set status = 'reserved' where code = 'TEST-THREE'$$, 0);
select pg_temp.expect_rows($$update public.profiles set role = 'admin' where full_name = 'Sales'$$, 0);
select pg_temp.expect_rows($$update public.project_members set role = 'project_director'$$, 0);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select pg_temp.expect_rows($$update public.halls set sort_order = 2 where name = 'Hall A'$$, 1);
select pg_temp.expect_rows($$update public.booths set width = 2, status = 'blocked' where code = 'TEST-TWO'$$, 1);
select pg_temp.expect_rows($$update public.booths set status = 'available' where code = 'TEST-TWO'$$, 1);
select pg_temp.expect_denied($$update public.booths set status = 'blocked' where code = 'TEST-ONE'$$);
select pg_temp.expect_denied($$update public.booths set exhibitor_name = 'Edited' where code = 'TEST-ONE'$$);
select pg_temp.expect_denied($$update public.booths set hall_id = '30000000-0000-0000-0000-000000000002' where code = 'TEST-TWO'$$);
select pg_temp.expect_rows($$update public.exhibitors set name = 'Forbidden' where name = 'Exhibitor A'$$, 0);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select pg_temp.expect_rows($$select id from public.exhibitors where name = 'Exhibitor A'$$, 1);
select pg_temp.expect_rows($$select id from public.booths where code like 'TEST-%'$$, 2);
select pg_temp.expect_rows($$select id from public.finance_records$$, 0);
select pg_temp.expect_rows($$update public.projects set name = 'Forbidden' where code = 'TEST-A'$$, 0);
select pg_temp.expect_rows($$update public.booths set status = 'blocked' where code = 'TEST-TWO'$$, 0);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
select pg_temp.expect_rows($$select id from public.projects$$, 0);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
select pg_temp.expect_rows($$select id from public.projects$$, 0);
select pg_temp.expect_rows($$select id from public.profiles$$, 0);

set local role anon;
select pg_temp.expect_denied($$select id from public.projects$$);
select pg_temp.expect_denied($$select id from public.booths$$);

rollback;

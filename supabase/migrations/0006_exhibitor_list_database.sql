-- VEGA CRM & ERP: KIF 2026 exhibitor list support
-- Event-specific source data and import provenance; reusable company records remain in public.companies.
alter table public.exhibitors
  add column if not exists source_sr_no text,
  add column if not exists source_status text,
  add column if not exists stand_no text,
  add column if not exists area_sqm numeric(10,2),
  add column if not exists stand_type text,
  add column if not exists hall text,
  add column if not exists source_country text,
  add column if not exists import_batch_id uuid,
  add column if not exists source_row_number integer;

create index if not exists exhibitors_exhibition_company_name_idx on public.exhibitors (exhibition_id, lower(company_name));
create index if not exists exhibitors_exhibition_stand_no_idx on public.exhibitors (exhibition_id, stand_no);
create index if not exists exhibitors_exhibition_country_idx on public.exhibitors (exhibition_id, coalesce(source_country, country));
create index if not exists exhibitors_import_batch_idx on public.exhibitors (import_batch_id);

create table if not exists public.exhibitor_import_batches (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  source_filename text not null,
  source_sheet text,
  source_row_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  import_mode text not null default 'preview' check (import_mode in ('preview','merge','replace')),
  status text not null default 'pending' check (status in ('pending','validated','completed','failed')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.exhibitor_import_batches enable row level security;
create policy "Authenticated team read exhibitor import batches" on public.exhibitor_import_batches for select to authenticated using (true);
create policy "Authenticated team insert exhibitor import batches" on public.exhibitor_import_batches for insert to authenticated with check (auth.uid() is not null);
create policy "Authenticated team update exhibitor import batches" on public.exhibitor_import_batches for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated team delete exhibitor import batches" on public.exhibitor_import_batches for delete to authenticated using (auth.uid() is not null);

-- Exhibitors are shared internal CRM records. Existing RLS had no policies in this project.
create policy "Authenticated team read exhibitors" on public.exhibitors for select to authenticated using (auth.uid() is not null);
create policy "Authenticated team insert exhibitors" on public.exhibitors for insert to authenticated with check (auth.uid() is not null);
create policy "Authenticated team update exhibitors" on public.exhibitors for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated team delete exhibitors" on public.exhibitors for delete to authenticated using (auth.uid() is not null);

-- VEGA deployment support migration 0004
-- Adds the generic module store used by the dashboard scaffolding.
create table if not exists public.module_records (
  id uuid primary key default gen_random_uuid(),
  module_name text not null,
  record_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists module_records_module_created_idx
  on public.module_records(module_name, created_at desc);
alter table public.module_records enable row level security;
drop policy if exists "VEGA staff read module records" on public.module_records;
drop policy if exists "VEGA staff insert own module records" on public.module_records;
drop policy if exists "VEGA staff update own module records" on public.module_records;
drop policy if exists "VEGA staff delete own module records" on public.module_records;
create policy "VEGA staff read module records" on public.module_records
  for select to authenticated
  using (public.current_role() in ('admin','staff','accountant'));
create policy "VEGA staff insert own module records" on public.module_records
  for insert to authenticated
  with check (created_by = auth.uid() and public.current_role() in ('admin','staff','accountant'));
create policy "VEGA staff update own module records" on public.module_records
  for update to authenticated
  using (created_by = auth.uid() and public.current_role() in ('admin','staff','accountant'))
  with check (created_by = auth.uid() and public.current_role() in ('admin','staff','accountant'));
create policy "VEGA staff delete own module records" on public.module_records
  for delete to authenticated
  using (created_by = auth.uid() and public.current_role() in ('admin','staff','accountant'));

alter table public.booths add column if not exists created_at timestamptz not null default now();

-- Apply RLS to expanded modules and grant access only to signed-in VEGA staff roles.
do $$
declare t text;
begin
  foreach t in array array['companies','sponsorships','booth_reservations','exhibition_checklists','quotations','contracts','credit_notes','installments','exchange_rates','accounts','account_transactions','suppliers','purchase_orders','issue_reports','staff_profiles','staff_schedules','attendance','chat_messages','warehouses','stock_movements','asset_checkouts','automation_rules','email_campaigns','approvals','audit_log','user_devices','document_expiry_alerts','portal_users','visitors','event_pages','sponsor_packages','online_payments','badges','venues','shipments','facility_bookings','vendor_rfqs','support_tickets','project_dependencies','risk_register','analytics_saved_reports','mobile_sync_queue','exhibition_portfolios','exhibition_calendar_conflicts','booth_pricing_rules','exhibitor_products','exhibitor_lead_scans','networking_appointments','exhibitor_campaigns','vega_ai_insights','integration_connections','webhook_subscriptions','integration_event_logs','integration_field_mappings','scheduled_sync_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "VEGA internal workspace access" on public.%I', t);
    if t = any(array['quotations','contracts','credit_notes','installments','exchange_rates','accounts','account_transactions','purchase_orders','online_payments']) then
      execute format('create policy "VEGA internal workspace access" on public.%I for all to authenticated using (public.current_role() in (''admin'',''accountant'')) with check (public.current_role() in (''admin'',''accountant''))', t);
    else
      execute format('create policy "VEGA internal workspace access" on public.%I for all to authenticated using (public.current_role() in (''admin'',''staff'',''accountant'')) with check (public.current_role() in (''admin'',''staff'',''accountant''))', t);
    end if;
  end loop;
end $$;

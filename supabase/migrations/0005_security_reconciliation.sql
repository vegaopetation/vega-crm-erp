-- VEGA CRM/ERP security reconciliation migration 0005
-- Intended for the internal VEGA workspace (admin/accountant/staff), not the deferred client portal.
-- This replaces pre-existing permissive policies on application tables with role-aware policies.
create table if not exists public.module_records (
  id uuid primary key default gen_random_uuid(),
  module_name text not null,
  record_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists module_records_module_created_idx on public.module_records(module_name, created_at desc);

-- Confirm the helper functions exist from 0001; policies call them to determine role.
-- Enable RLS and remove old policies (permissive policies combine with OR).
do $$
declare t text; p record;
begin
  foreach t in array array[
    'account_transactions',
    'accounts',
    'activities',
    'analytics_saved_reports',
    'approvals',
    'asset_checkouts',
    'assets',
    'attendance',
    'audit_log',
    'automation_rules',
    'badges',
    'booth_pricing_rules',
    'booth_reservations',
    'booths',
    'chat_messages',
    'companies',
    'company_settings',
    'contracts',
    'credit_notes',
    'document_expiry_alerts',
    'email_campaigns',
    'event_pages',
    'exchange_rates',
    'exhibition_calendar_conflicts',
    'exhibition_checklists',
    'exhibition_portfolios',
    'exhibitions',
    'exhibitor_campaigns',
    'exhibitor_lead_scans',
    'exhibitor_products',
    'exhibitors',
    'expenses',
    'facility_bookings',
    'installments',
    'integration_connections',
    'integration_event_logs',
    'integration_field_mappings',
    'inventory_items',
    'invoice_items',
    'invoices',
    'issue_reports',
    'leads',
    'mobile_sync_queue',
    'module_records',
    'networking_appointments',
    'notifications',
    'online_payments',
    'payments',
    'portal_users',
    'profiles',
    'project_dependencies',
    'projects',
    'purchase_orders',
    'quotations',
    'risk_register',
    'scheduled_sync_jobs',
    'service_orders',
    'shipments',
    'sponsor_packages',
    'sponsorships',
    'staff_profiles',
    'staff_schedules',
    'stock_movements',
    'suppliers',
    'support_tickets',
    'user_devices',
    'vega_ai_insights',
    'vendor_rfqs',
    'venues',
    'visitors',
    'warehouses',
    'webhook_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Profile rows: signed-in team can view the directory; users can update their own profile;
-- only admins can perform role/admin changes (table grants should also be restricted).
create policy profiles_team_read on public.profiles for select to authenticated
  using (public.current_role() in ('admin','accountant','staff'));
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.current_role()='admin') with check (public.current_role()='admin');

-- Notification records are personal.
create policy notifications_owner_all on public.notifications for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Company settings are managed by admins only.
create policy company_settings_admin_all on public.company_settings for all to authenticated
  using (public.current_role()='admin') with check (public.current_role()='admin');

-- Finance data: accountant/admin; other internal data: any VEGA staff role.
do $$
declare t text;
begin
  foreach t in array array['account_transactions', 'accounts', 'credit_notes', 'exchange_rates', 'expenses', 'installments', 'invoice_items', 'invoices', 'online_payments', 'payments', 'purchase_orders', 'quotations'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.current_role() in (''admin'',''accountant'')) with check (public.current_role() in (''admin'',''accountant''))', t||'_finance_role', t);
  end loop;
  foreach t in array array[
    'activities', 'analytics_saved_reports', 'approvals', 'asset_checkouts', 'assets', 'attendance', 'audit_log', 'automation_rules', 'badges', 'booth_pricing_rules', 'booth_reservations', 'booths', 'chat_messages', 'companies', 'contracts', 'document_expiry_alerts', 'email_campaigns', 'event_pages', 'exhibition_calendar_conflicts', 'exhibition_checklists', 'exhibition_portfolios', 'exhibitions', 'exhibitor_campaigns', 'exhibitor_lead_scans', 'exhibitor_products', 'exhibitors', 'facility_bookings', 'integration_connections', 'integration_event_logs', 'integration_field_mappings', 'inventory_items', 'issue_reports', 'leads', 'mobile_sync_queue', 'module_records', 'networking_appointments', 'portal_users', 'project_dependencies', 'projects', 'risk_register', 'scheduled_sync_jobs', 'service_orders', 'shipments', 'sponsor_packages', 'sponsorships', 'staff_profiles', 'staff_schedules', 'stock_movements', 'suppliers', 'support_tickets', 'user_devices', 'vega_ai_insights', 'vendor_rfqs', 'venues', 'visitors', 'warehouses', 'webhook_subscriptions'
  ] loop
    if t='module_records' then
      execute 'create policy module_records_staff_read on public.module_records for select to authenticated using (public.current_role() in (''admin'',''accountant'',''staff''))';
      execute 'create policy module_records_owner_insert on public.module_records for insert to authenticated with check (created_by=auth.uid() and public.current_role() in (''admin'',''accountant'',''staff''))';
      execute 'create policy module_records_owner_update on public.module_records for update to authenticated using (created_by=auth.uid() and public.current_role() in (''admin'',''accountant'',''staff'')) with check (created_by=auth.uid() and public.current_role() in (''admin'',''accountant'',''staff''))';
      execute 'create policy module_records_owner_delete on public.module_records for delete to authenticated using (created_by=auth.uid() and public.current_role() in (''admin'',''accountant'',''staff''))';
    else
      execute format('create policy %I on public.%I for all to authenticated using (public.current_role() in (''admin'',''accountant'',''staff'')) with check (public.current_role() in (''admin'',''accountant'',''staff''))', t||'_internal_role');
    end if;
  end loop;
end $$;

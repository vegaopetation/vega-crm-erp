-- VEGA CRM/ERP advanced business, networking, AI and integration extension
-- Apply after migrations 0001 and 0002. Uses organization-scoped data and RLS.
create table if not exists exhibition_portfolios (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 name text not null, brand text, country text, branch_name text, owner_name text,
 franchise_partner text, license_start date, license_end date, budget numeric(14,2) default 0,
 currency text default 'AED', status text default 'active', created_at timestamptz default now()
);
create table if not exists exhibition_calendar_conflicts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibition_id uuid, conflicting_exhibition_id uuid, venue text, conflict_start date,
 conflict_end date, resolution text, status text default 'open', created_at timestamptz default now()
);
create table if not exists booth_pricing_rules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibition_id uuid, booth_code text, zone text, base_price numeric(14,2) default 0,
 area_sqm numeric(10,2), demand_factor numeric(8,4) default 1, location_premium numeric(14,2) default 0,
 suggested_price numeric(14,2), discount_limit numeric(8,4), approval_status text default 'pending',
 created_at timestamptz default now()
);
create table if not exists exhibitor_products (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 company_id uuid, exhibitor_id uuid, exhibition_id uuid, product_name text not null,
 category text, description text, media_urls jsonb default '[]'::jsonb,
 digital_profile_url text, visibility text default 'private', created_at timestamptz default now()
);
create table if not exists exhibitor_lead_scans (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibitor_id uuid, exhibition_id uuid, contact_name text, contact_email text,
 qr_card_code text, scanned_at timestamptz default now(), consent_status text,
 follow_up_status text default 'new'
);
create table if not exists networking_appointments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibition_id uuid, exhibitor_id uuid, visitor_id uuid, buyer_name text,
 meeting_at timestamptz, location text, matching_score numeric(5,2),
 status text default 'requested', created_at timestamptz default now()
);
create table if not exists exhibitor_campaigns (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibition_id uuid, exhibitor_id uuid, name text not null, channel text,
 budget numeric(14,2) default 0, reach integer default 0, leads integer default 0,
 conversions integer default 0, status text default 'draft', created_at timestamptz default now()
);
create table if not exists vega_ai_insights (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 exhibition_id uuid, insight_type text not null, subject_id uuid, input_summary jsonb default '{}'::jsonb,
 recommendation text, score numeric(8,2), review_status text default 'pending',
 created_at timestamptz default now()
);
create table if not exists integration_connections (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 provider text not null, integration_type text not null, account_label text,
 config_metadata jsonb default '{}'::jsonb, secret_reference text,
 sync_direction text, sync_schedule text, last_sync_at timestamptz,
 connection_status text default 'not_configured', created_at timestamptz default now()
);
create table if not exists webhook_subscriptions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 name text not null, event_type text not null, destination_url text not null,
 secret_reference text, enabled boolean default false, created_at timestamptz default now()
);
create table if not exists integration_event_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 integration_id uuid, event_type text, direction text, payload_summary jsonb default '{}'::jsonb,
 response_code integer, error_message text, processed_at timestamptz default now()
);
create table if not exists integration_field_mappings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 integration_id uuid, source_object text not null, source_field text not null,
 target_object text not null, target_field text not null, transform_rule text,
 created_at timestamptz default now()
);
create table if not exists scheduled_sync_jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 integration_id uuid, name text not null, schedule_expression text,
 data_scope jsonb default '{}'::jsonb, last_run_at timestamptz, next_run_at timestamptz,
 records_processed integer default 0, status text default 'scheduled', created_at timestamptz default now()
);
-- RLS policies should be configured with the organization's authenticated membership model.

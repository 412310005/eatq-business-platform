-- EatQ FINAL STABLE SCHEMA SYNC SQL
-- Purpose: synchronize the production code's customers / leads schema.
--
-- Allowed operations only:
-- - alter table add column if not exists
-- - create index if not exists
-- - drop constraint if exists
-- - add constraint
--
-- Explicitly not included:
-- - drop table
-- - drop column
-- - truncate
-- - delete data
-- - update/backfill data
-- - function/trigger creation
-- - type conversion
--
-- Note:
-- Constraints are added as NOT VALID so this file does not rewrite or repair
-- existing rows. New/updated rows are still checked by PostgreSQL.

-- ---------------------------------------------------------------------------
-- leads: production BD collaboration schema
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists store_name text not null default '',
  add column if not exists address text not null default '',
  add column if not exists category text not null default 'restaurant',
  add column if not exists source text not null default 'manual',
  add column if not exists status text not null default 'new',
  add column if not exists owner_name text not null default '',
  add column if not exists contact_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists line_id text not null default '',
  add column if not exists last_follow_up_at timestamptz,
  add column if not exists ai_summary text,
  add column if not exists pitch_email text,
  add column if not exists notes text not null default '',
  add column if not exists is_deleted boolean not null default false,
  add column if not exists business_id uuid,
  add column if not exists osm_id text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists created_at timestamptz not null default now();

alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check
  check (source in ('manual', 'osm', 'crm')) not valid;

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'contacted', 'interested', 'meeting', 'negotiating', 'converted', 'lost')) not valid;

create index if not exists leads_store_name_idx on public.leads (store_name);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_owner_name_idx on public.leads (owner_name);
create index if not exists leads_last_follow_up_at_idx on public.leads (last_follow_up_at desc);
create index if not exists leads_is_deleted_idx on public.leads (is_deleted);
create index if not exists leads_osm_id_idx on public.leads (osm_id) where osm_id is not null;
create index if not exists leads_business_id_idx on public.leads (business_id) where business_id is not null;
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ---------------------------------------------------------------------------
-- customers: production lightweight customer CRM schema
-- ---------------------------------------------------------------------------

alter table public.customers
  add column if not exists lead_id uuid,
  add column if not exists store_name text not null default '',
  add column if not exists address text not null default '',
  add column if not exists bd_owner text not null default '',
  add column if not exists contact_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists line_id text not null default '',
  add column if not exists customer_status text not null default 'trial',
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deal_amount numeric(12,2) not null default 0,
  add column if not exists subscription_plan text not null default 'sticker_system',
  add column if not exists enabled_features text[] not null default '{}'::text[],
  add column if not exists usage_count integer not null default 0,
  add column if not exists usage_limit integer not null default 100,
  add column if not exists monthly_revenue numeric(12,2) not null default 0,
  add column if not exists contract_started_at date,
  add column if not exists contract_ends_at date,
  add column if not exists renewal_status text not null default 'preparing',
  add column if not exists risk_level text not null default 'low',
  add column if not exists last_active_at timestamptz,
  add column if not exists notes text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.customers
  add column if not exists usage_rate numeric generated always as (
    case
      when usage_limit > 0 then round((usage_count::numeric / usage_limit::numeric) * 100, 2)
      else 0
    end
  ) stored;

alter table public.customers
  drop constraint if exists customers_customer_status_check;

alter table public.customers
  add constraint customers_customer_status_check
  check (customer_status in ('trial', 'active', 'paused', 'churned')) not valid;

alter table public.customers
  drop constraint if exists customers_subscription_plan_check;

alter table public.customers
  add constraint customers_subscription_plan_check
  check (subscription_plan in ('sticker_system', 'reservation_system', 'queue_system')) not valid;

alter table public.customers
  drop constraint if exists customers_renewal_status_check;

alter table public.customers
  add constraint customers_renewal_status_check
  check (renewal_status in ('preparing', 'negotiating', 'renewed', 'cancelled')) not valid;

alter table public.customers
  drop constraint if exists customers_risk_level_check;

alter table public.customers
  add constraint customers_risk_level_check
  check (risk_level in ('low', 'medium', 'high')) not valid;

alter table public.customers
  drop constraint if exists customers_usage_count_check;

alter table public.customers
  add constraint customers_usage_count_check
  check (usage_count >= 0) not valid;

alter table public.customers
  drop constraint if exists customers_usage_limit_check;

alter table public.customers
  add constraint customers_usage_limit_check
  check (usage_limit >= 0) not valid;

alter table public.customers
  drop constraint if exists customers_monthly_revenue_check;

alter table public.customers
  add constraint customers_monthly_revenue_check
  check (monthly_revenue >= 0) not valid;

alter table public.customers
  drop constraint if exists customers_deal_amount_check;

alter table public.customers
  add constraint customers_deal_amount_check
  check (deal_amount >= 0) not valid;

alter table public.customers
  drop constraint if exists customers_lead_id_fkey;

alter table public.customers
  add constraint customers_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null not valid;

create index if not exists customers_lead_id_idx on public.customers (lead_id) where lead_id is not null;
create index if not exists customers_store_name_idx on public.customers (store_name);
create index if not exists customers_status_idx on public.customers (customer_status);
create index if not exists customers_bd_owner_idx on public.customers (bd_owner);
create index if not exists customers_is_deleted_idx on public.customers (is_deleted);
create index if not exists customers_contract_ends_at_idx on public.customers (contract_ends_at);
create index if not exists customers_created_at_idx on public.customers (created_at desc);

-- ---------------------------------------------------------------------------
-- Currently used by production code checklist
-- ---------------------------------------------------------------------------
--
-- leads
-- [x] id
-- [x] store_name
-- [x] address
-- [x] category
-- [x] source
-- [x] status
-- [x] owner_name
-- [x] contact_name
-- [x] phone
-- [x] line_id
-- [x] last_follow_up_at
-- [x] ai_summary
-- [x] pitch_email
-- [x] notes
-- [x] is_deleted
-- [x] business_id
-- [x] osm_id
-- [x] lat
-- [x] lng
-- [x] created_at
--
-- customers
-- [x] id
-- [x] lead_id
-- [x] store_name
-- [x] address
-- [x] bd_owner
-- [x] contact_name
-- [x] phone
-- [x] line_id
-- [x] customer_status
-- [x] is_deleted
-- [x] deal_amount
-- [x] subscription_plan
-- [x] enabled_features
-- [x] usage_count
-- [x] usage_limit
-- [x] usage_rate
-- [x] monthly_revenue
-- [x] contract_started_at
-- [x] contract_ends_at
-- [x] renewal_status
-- [x] risk_level
-- [x] last_active_at
-- [x] notes
-- [x] created_at
-- [x] updated_at
--
-- joined relation used by getCustomers()
-- [x] customers.lead_id -> leads.id
-- [x] leads.ai_summary
-- [x] leads.pitch_email
-- [x] leads.last_follow_up_at
-- [x] leads.status

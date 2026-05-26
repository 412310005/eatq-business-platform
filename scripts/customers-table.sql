-- EatQ CRM：正式客戶（customers）
-- 在 Supabase SQL Editor 執行一次

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid unique references public.leads(id) on delete set null,
  store_name text not null,
  address text not null default '',
  bd_owner text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  line_id text not null default '',
  is_deleted boolean not null default false,
  customer_status text not null default 'trial'
    check (customer_status in ('trial', 'active', 'paused', 'churned')),
  deal_amount numeric(12,2) not null default 0 check (deal_amount >= 0),
  subscription_plan text not null default 'sticker_system'
    check (subscription_plan in ('sticker_system', 'reservation_system', 'queue_system')),
  enabled_features text[] not null default '{}'::text[],
  usage_count integer not null default 0 check (usage_count >= 0),
  usage_limit integer not null default 0 check (usage_limit >= 0),
  usage_rate numeric(6,2) generated always as (
    case
      when usage_limit > 0 then round((usage_count::numeric / usage_limit::numeric) * 100, 2)
      else 0
    end
  ) stored,
  monthly_revenue numeric(12,2) not null default 0 check (monthly_revenue >= 0),
  contract_started_at date,
  contract_ends_at date,
  renewal_status text not null default 'preparing'
    check (renewal_status in ('preparing', 'negotiating', 'renewed', 'cancelled')),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high')),
  last_active_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_status_idx on public.customers (customer_status);
create index if not exists customers_is_deleted_idx on public.customers (is_deleted);
create index if not exists customers_renewal_status_idx on public.customers (renewal_status);
create index if not exists customers_risk_level_idx on public.customers (risk_level);
create index if not exists customers_created_at_idx on public.customers (created_at desc);

create or replace function public.set_customers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_customers_updated_at();

comment on table public.customers is '正式客戶資料（由 leads 簽 MOU 轉換而來）';

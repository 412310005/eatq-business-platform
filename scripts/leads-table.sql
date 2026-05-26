-- EatQ CRM：欲開發名單（leads）
-- 在 Supabase SQL Editor 執行一次

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  address text not null default '',
  category text not null default 'restaurant',
  source text not null default 'manual' check (source in ('manual', 'osm', 'crm')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'interested', 'meeting', 'negotiating', 'converted', 'lost')),
  owner_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  line_id text not null default '',
  last_follow_up_at timestamptz,
  is_deleted boolean not null default false,
  ai_summary text,
  pitch_email text,
  notes text not null default '',
  business_id uuid references public.businesses(id) on delete set null,
  osm_id text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_owner_name_idx on public.leads (owner_name);
create index if not exists leads_last_follow_up_at_idx on public.leads (last_follow_up_at desc);
create index if not exists leads_is_deleted_idx on public.leads (is_deleted);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_osm_id_idx on public.leads (osm_id) where osm_id is not null;

comment on table public.leads is '欲開發名單（店家 → 業務）';
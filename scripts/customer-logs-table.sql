-- EatQ CRM：客戶異動紀錄（customer_logs）
-- 在 Supabase SQL Editor 執行一次；可重跑。

create table if not exists public.customer_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  action_type text not null,
  old_status text,
  new_status text,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.customer_logs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists customer_id uuid,
  add column if not exists action_type text not null default 'status_changed',
  add column if not exists old_status text,
  add column if not exists new_status text,
  add column if not exists note text not null default '',
  add column if not exists created_at timestamptz not null default now();

create index if not exists customer_logs_customer_id_idx on public.customer_logs (customer_id);
create index if not exists customer_logs_action_type_idx on public.customer_logs (action_type);
create index if not exists customer_logs_created_at_idx on public.customer_logs (created_at desc);

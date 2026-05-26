-- EatQ CRM：BD 協作開發 leads migration
-- 用於已建立 leads table 的 Supabase 專案。
--
-- 目標：
-- 1. 新增 BD 協作欄位：owner_name / contact_name / phone / line_id / last_follow_up_at
-- 2. 將 status 轉為 BD 開發階段：
--    new / contacted / interested / meeting / negotiating / converted / lost
-- 3. 移除 osm_id unique index，改由 UI warning modal 提醒，允許使用者選擇「仍要加入」

alter table public.leads
  add column if not exists owner_name text not null default '',
  add column if not exists contact_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists line_id text not null default '',
  add column if not exists last_follow_up_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

alter table public.leads
  drop constraint if exists leads_status_check;

update public.leads
set status = case status
  when 'pending' then 'new'
  when 'tracking' then 'interested'
  when 'won' then 'converted'
  when 'customer' then 'converted'
  when 'new' then 'new'
  when 'contacted' then 'contacted'
  when 'interested' then 'interested'
  when 'meeting' then 'meeting'
  when 'negotiating' then 'negotiating'
  when 'converted' then 'converted'
  when 'lost' then 'lost'
  else 'new'
end;

update public.leads
set last_follow_up_at = coalesce(last_follow_up_at, created_at);

alter table public.leads
  alter column status set default 'new';

alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'contacted', 'interested', 'meeting', 'negotiating', 'converted', 'lost'));

drop index if exists public.leads_osm_id_unique;
create index if not exists leads_osm_id_idx on public.leads (osm_id) where osm_id is not null;
create index if not exists leads_owner_name_idx on public.leads (owner_name);
create index if not exists leads_last_follow_up_at_idx on public.leads (last_follow_up_at desc);
create index if not exists leads_is_deleted_idx on public.leads (is_deleted);


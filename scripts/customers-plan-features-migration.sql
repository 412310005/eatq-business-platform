-- EatQ CRM：customers plan / AI features split migration
-- 用於已建立 customers table 的 Supabase 專案。
--
-- 目標：
-- 1. subscription_plan 僅保留真正 SaaS plan:
--    sticker_system / reservation_system / queue_system
-- 2. AI 評論分析改放 enabled_features text[]
-- 3. 新增 bd_owner 欄位供 BD 負責人使用

alter table public.customers
  add column if not exists bd_owner text not null default '';

alter table public.customers
  add column if not exists enabled_features text[] not null default '{}'::text[];

alter table public.customers
  drop constraint if exists customers_subscription_plan_check;

update public.customers
set enabled_features =
  case
    when not ('review_analysis' = any(enabled_features))
      then array_append(enabled_features, 'review_analysis')
    else enabled_features
  end
where subscription_plan = 'AI評論分析';

update public.customers
set subscription_plan = case subscription_plan
  when '剩食系統' then 'sticker_system'
  when '排隊系統' then 'queue_system'
  when 'AI評論分析' then 'sticker_system'
  when 'sticker_system' then 'sticker_system'
  when 'reservation_system' then 'reservation_system'
  when 'queue_system' then 'queue_system'
  else 'sticker_system'
end;

alter table public.customers
  alter column subscription_plan set default 'sticker_system';

alter table public.customers
  add constraint customers_subscription_plan_check
  check (subscription_plan in ('sticker_system', 'reservation_system', 'queue_system'));


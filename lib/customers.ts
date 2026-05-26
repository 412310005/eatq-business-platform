import { supabase } from '@/lib/supabase'
import { createCustomerLog } from '@/lib/customerLogs'
import type { LeadRow } from '@/lib/leads'

export type CustomerStatus = 'trial' | 'active' | 'paused' | 'churned'
export type SubscriptionPlan = 'sticker_system' | 'reservation_system' | 'queue_system'
export type RenewalStatus = 'preparing' | 'negotiating' | 'renewed' | 'cancelled'
export type RiskLevel = 'low' | 'medium' | 'high'

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  trial: '試用中',
  active: '正式使用',
  paused: '暫停',
  churned: '已流失',
}

export const SELECTABLE_CUSTOMER_STATUSES = ['trial', 'active', 'paused'] as const

const CUSTOMER_STATUS_TRANSITIONS: Record<(typeof SELECTABLE_CUSTOMER_STATUSES)[number], (typeof SELECTABLE_CUSTOMER_STATUSES)[number][]> = {
  trial: ['trial', 'active'],
  active: ['active', 'paused'],
  paused: ['paused', 'active'],
}

export function isSelectableCustomerStatus(status: string): status is (typeof SELECTABLE_CUSTOMER_STATUSES)[number] {
  return SELECTABLE_CUSTOMER_STATUSES.includes(status as (typeof SELECTABLE_CUSTOMER_STATUSES)[number])
}

export function getAllowedCustomerStatusOptions(currentStatus: CustomerStatus): CustomerStatus[] {
  if (!isSelectableCustomerStatus(currentStatus)) return []
  return CUSTOMER_STATUS_TRANSITIONS[currentStatus]
}

export function isAllowedCustomerStatusTransition(currentStatus: CustomerStatus, nextStatus: CustomerStatus): boolean {
  return getAllowedCustomerStatusOptions(currentStatus).includes(nextStatus)
}

export const RENEWAL_STATUS_LABEL: Record<RenewalStatus, string> = {
  preparing: '準備續約',
  negotiating: '洽談中',
  renewed: '已續約',
  cancelled: '已取消',
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: '低風險',
  medium: '中風險',
  high: '高風險',
}

export const SUBSCRIPTION_PLAN_LABEL: Record<SubscriptionPlan, string> = {
  sticker_system: '剩食貼紙系統',
  reservation_system: '訂位系統',
  queue_system: '排隊系統',
}

export function normalizeSubscriptionPlan(plan: string): SubscriptionPlan {
  if (plan === 'queue_system' || plan === '排隊系統') return 'queue_system'
  if (plan === 'reservation_system') return 'reservation_system'
  return 'sticker_system'
}

export function subscriptionPlanLabel(plan: string): string {
  return SUBSCRIPTION_PLAN_LABEL[normalizeSubscriptionPlan(plan)]
}

export interface CustomerRow {
  id: string
  lead_id: string | null
  store_name: string
  address: string
  bd_owner: string
  contact_name: string
  phone: string
  line_id: string
  customer_status: CustomerStatus
  is_deleted: boolean
  deal_amount: number
  subscription_plan: SubscriptionPlan
  enabled_features: string[]
  usage_count: number
  usage_limit: number
  usage_rate: number
  monthly_revenue: number
  contract_started_at: string | null
  contract_ends_at: string | null
  renewal_status: RenewalStatus
  risk_level: RiskLevel
  last_active_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type CustomerWithLead = CustomerRow & {
  leads?: Pick<LeadRow, 'ai_summary' | 'pitch_email' | 'last_follow_up_at' | 'status'> | null
}

export type CustomerInsert = Omit<CustomerRow, 'id' | 'usage_rate' | 'created_at' | 'updated_at'> & {
  id?: string
}

export type CustomerUpdate = Partial<Omit<CustomerInsert, 'id' | 'lead_id'>>

export function buildCustomerFromLead(lead: LeadRow): CustomerInsert {
  const start = new Date()
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + 1)

  return {
    lead_id: lead.id,
    store_name: lead.store_name,
    address: lead.address ?? '',
    bd_owner: lead.owner_name ?? '',
    contact_name: lead.contact_name ?? '',
    phone: lead.phone ?? '',
    line_id: lead.line_id ?? '',
    customer_status: 'trial',
    is_deleted: false,
    deal_amount: 0,
    subscription_plan: 'sticker_system',
    enabled_features: [],
    usage_count: 0,
    usage_limit: 100,
    monthly_revenue: 0,
    contract_started_at: start.toISOString().slice(0, 10),
    contract_ends_at: end.toISOString().slice(0, 10),
    renewal_status: 'preparing',
    risk_level: 'low',
    last_active_at: null,
    notes: lead.notes ?? '',
  }
}

export async function getCustomers(): Promise<{ customers: CustomerWithLead[]; error: string | null }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*, leads(ai_summary, pitch_email, last_follow_up_at, status)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) return { customers: [], error: error.message }
  return { customers: (data ?? []) as CustomerWithLead[], error: null }
}

export async function getCustomerById(id: string): Promise<{ customer: CustomerWithLead | null; error: string | null }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*, leads(ai_summary, pitch_email, last_follow_up_at, status)')
    .eq('id', id)
    .maybeSingle()

  if (error) return { customer: null, error: error.message }
  return { customer: (data as CustomerWithLead) ?? null, error: null }
}

export async function createCustomer(input: CustomerInsert): Promise<{ customer: CustomerRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('customers')
    .insert(input)
    .select('*')
    .single()

  if (error) return { customer: null, error: error.message }
  await createCustomerLog({
    customer_id: data.id,
    action_type: 'customer_created',
    new_status: data.customer_status,
    note: '由欲開發名單建立客戶',
  })
  return { customer: data as CustomerRow, error: null }
}

export async function updateCustomer(id: string, patch: CustomerUpdate): Promise<string | null> {
  let oldStatus: CustomerStatus | null = null
  if (patch.customer_status !== undefined) {
    if (!isSelectableCustomerStatus(patch.customer_status)) {
      return '不允許的客戶狀態'
    }

    const { data } = await supabase
      .from('customers')
      .select('customer_status')
      .eq('id', id)
      .maybeSingle()
    oldStatus = (data?.customer_status as CustomerStatus | undefined) ?? null

    if (!oldStatus) return '找不到客戶狀態'
    if (!isAllowedCustomerStatusTransition(oldStatus, patch.customer_status)) {
      return `不允許的狀態轉換：${CUSTOMER_STATUS_LABEL[oldStatus]} → ${CUSTOMER_STATUS_LABEL[patch.customer_status]}`
    }
  }

  const { error } = await supabase.from('customers').update(patch).eq('id', id)
  if (!error && patch.customer_status && oldStatus && oldStatus !== patch.customer_status) {
    await createCustomerLog({
      customer_id: id,
      action_type: 'status_changed',
      old_status: oldStatus,
      new_status: patch.customer_status,
      note: '客戶狀態更新',
    })
  }
  return error?.message ?? null
}

export async function archiveCustomer(id: string): Promise<string | null> {
  const { data } = await supabase
    .from('customers')
    .select('customer_status')
    .eq('id', id)
    .maybeSingle()
  const currentStatus = (data?.customer_status as CustomerStatus | undefined) ?? null

  const { error } = await supabase.from('customers').update({ is_deleted: true }).eq('id', id)
  if (!error) {
    await createCustomerLog({
      customer_id: id,
      action_type: 'customer_deleted',
      old_status: currentStatus,
      new_status: currentStatus,
      note: '客戶已封存',
    })
  }
  return error?.message ?? null
}

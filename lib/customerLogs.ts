import { supabase } from '@/lib/supabase'
import type { CustomerStatus } from '@/lib/customers'

export type CustomerLogAction = 'customer_created' | 'status_changed' | 'customer_deleted'

export interface CustomerLogRow {
  id: string
  customer_id: string | null
  action_type: CustomerLogAction
  old_status: CustomerStatus | null
  new_status: CustomerStatus | null
  note: string
  created_at: string
  customers?: { store_name: string } | null
}

export async function createCustomerLog(input: {
  customer_id: string
  action_type: CustomerLogAction
  old_status?: CustomerStatus | null
  new_status?: CustomerStatus | null
  note?: string
}): Promise<string | null> {
  const { error } = await supabase.from('customer_logs').insert({
    customer_id: input.customer_id,
    action_type: input.action_type,
    old_status: input.old_status ?? null,
    new_status: input.new_status ?? null,
    note: input.note ?? '',
  })

  if (error) {
    console.warn('[customer_logs] insert failed:', error.message)
    return error.message
  }

  return null
}

export async function getCustomerLogs(): Promise<{ logs: CustomerLogRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('customer_logs')
    .select('*, customers(store_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { logs: [], error: error.message }
  return { logs: (data ?? []) as CustomerLogRow[], error: null }
}

export async function getLatestCustomerLogTimes(customerIds: string[]): Promise<Record<string, string>> {
  if (customerIds.length === 0) return {}

  const { data, error } = await supabase
    .from('customer_logs')
    .select('customer_id, created_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[customer_logs] latest log query failed:', error.message)
    return {}
  }

  return (data ?? []).reduce<Record<string, string>>((acc, row: { customer_id: string | null; created_at: string }) => {
    if (row.customer_id && !acc[row.customer_id]) acc[row.customer_id] = row.created_at
    return acc
  }, {})
}

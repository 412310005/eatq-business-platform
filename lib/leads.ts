import { supabase } from '@/lib/supabase'
import { buildEmailBody, DIRS, type DirKey, type Review } from '@/lib/constants'
import type { FoodWasteRiskResult } from '@/lib/analyzeFoodWasteRisk'
import type { OsmPlace } from '@/lib/overpass'

export type LeadSource = 'manual' | 'osm' | 'crm'
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'meeting' | 'negotiating' | 'converted' | 'lost'

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: '新名單' },
  { value: 'contacted', label: '已聯絡' },
  { value: 'interested', label: '有興趣' },
  { value: 'meeting', label: '已約會議' },
  { value: 'negotiating', label: '洽談中' },
  { value: 'converted', label: '已轉換' },
  { value: 'lost', label: '已流失' },
]

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  manual: '手動',
  osm: '地圖 OSM',
  crm: 'CRM 商家',
}

export interface LeadRow {
  id: string
  store_name: string
  address: string
  category: string
  source: LeadSource
  status: LeadStatus
  owner_name: string
  contact_name: string
  phone: string
  line_id: string
  last_follow_up_at: string | null
  ai_summary: string | null
  pitch_email: string | null
  notes: string
  is_deleted: boolean
  created_at: string
  business_id?: string | null
  osm_id?: string | null
  lat?: number | null
  lng?: number | null
}

export type LeadInsert = Omit<LeadRow, 'id' | 'created_at' | 'is_deleted'> & { id?: string; is_deleted?: boolean }

export function normalizeLeadStatus(status: string): LeadStatus {
  if (status === 'pending' || status === 'tracking') return 'new'
  if (status === 'won' || status === 'customer') return 'converted'
  if (LEAD_STATUS_OPTIONS.some(option => option.value === status)) return status as LeadStatus
  return 'new'
}

export function leadStatusLabel(status: LeadStatus): string {
  const normalized = normalizeLeadStatus(status)
  return LEAD_STATUS_OPTIONS.find(o => o.value === normalized)?.label ?? normalized
}

export function formatOsmAiSummary(result: FoodWasteRiskResult | null): string | null {
  if (!result) return null
  const parts: string[] = [`剩食相關度 ${result.score}%`]
  if (result.matchedKeywords.length > 0) {
    parts.push(`關鍵字：${result.matchedKeywords.join('、')}`)
  }
  if (result.matchedReviews.length > 0) {
    const snippets = result.matchedReviews.slice(0, 3).map(r => `「${r.text.slice(0, 48)}${r.text.length > 48 ? '…' : ''}」`)
    parts.push(`評論摘錄：${snippets.join('；')}`)
  }
  return parts.join('\n')
}

export function buildOsmPitchHtml(
  storeName: string,
  aiSummary: string | null,
  dirs: Record<string, boolean>,
  salesperson = '林○○',
): string {
  const painText = aiSummary
    ? aiSummary.replace(/\n/g, ' ').slice(0, 36) + (aiSummary.length > 36 ? '…' : '')
    : '剩食與食材管理'
  const activeDirs = (Object.keys(dirs) as DirKey[]).filter(k => dirs[k])
  let body = `您好，<br><br>我是 EatQ 業務員 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">${salesperson}</b>。我們注意到 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">${storeName}</b> 在顧客評論中出現 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">${painText}</b> 的狀況。<br><br>`
  if (activeDirs.length === 0) {
    body += 'EatQ 可以協助店家把剩食轉為收入，推廣期提供一年免費試用。<br><br>'
  } else {
    body += 'EatQ 針對您的店提供以下幫助：<br>'
    activeDirs.forEach(k => {
      const d = DIRS[k]
      body += `<br><span style="background:${d.bg};color:${d.tc};padding:1px 5px;border-radius:3px;font-size:11px">${d.label}</span> ${d.pitch}<br>`
    })
    body += '<br>'
  }
  body += `目前推廣期提供 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">一年完全免費試用</b>，誠摯邀請您體驗。<br><br>請問方便安排 10 分鐘讓我當面說明嗎？<br><br>${salesperson} · EatQ 台南業務`
  return body
}

export function pitchHtmlToPlain(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

export function buildLeadEmailUrl(params: {
  storeName: string
  address?: string
  category?: string
  aiSummary?: string | null
  source?: LeadSource
  osmId?: string
  lat?: number
  lng?: string | number
  businessId?: string
}): string {
  const q = new URLSearchParams()
  q.set('name', params.storeName)
  if (params.address) q.set('address', params.address)
  if (params.category) q.set('category', params.category)
  if (params.aiSummary) q.set('aiSummary', params.aiSummary)
  if (params.source) q.set('source', params.source)
  if (params.osmId) q.set('osmId', params.osmId)
  if (params.lat != null) q.set('lat', String(params.lat))
  if (params.lng != null) q.set('lng', String(params.lng))
  if (params.businessId) q.set('id', params.businessId)
  return `/dashboard/email?${q.toString()}`
}

function normKey(name: string, address: string): string {
  return `${name.trim().toLowerCase()}|${address.trim().toLowerCase()}`
}

async function hasActiveCustomerForLead(leadId: string): Promise<boolean> {
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('lead_id', leadId)
    .eq('is_deleted', false)
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

async function isActiveDuplicateLead(lead: LeadRow): Promise<boolean> {
  if (!['converted', 'customer', 'won'].includes(lead.status)) return true
  return hasActiveCustomerForLead(lead.id)
}

export async function listLeads(): Promise<{ data: LeadRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  if (error) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []) as LeadRow[], error: null }
}

export async function getLeadById(id: string): Promise<{ lead: LeadRow | null; error: string | null }> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (error) return { lead: null, error: error.message }
  return { lead: (data as LeadRow) ?? null, error: null }
}

export async function findExistingLead(opts: {
  osmId?: string | null
  businessId?: string | null
  storeName?: string
  address?: string
}): Promise<LeadRow | null> {
  if (opts.osmId) {
    const { data } = await supabase.from('leads').select('*').eq('osm_id', opts.osmId).eq('is_deleted', false).maybeSingle()
    if (data && await isActiveDuplicateLead(data as LeadRow)) return data as LeadRow
  }
  if (opts.businessId) {
    const { data } = await supabase.from('leads').select('*').eq('business_id', opts.businessId).eq('is_deleted', false).maybeSingle()
    if (data && await isActiveDuplicateLead(data as LeadRow)) return data as LeadRow
  }
  if (opts.storeName) {
    const { data: rows } = await supabase
      .from('leads')
      .select('*')
      .ilike('store_name', opts.storeName.trim())
      .eq('is_deleted', false)
      .limit(20)
    const key = normKey(opts.storeName, opts.address ?? '')
    const targetAddress = (opts.address ?? '').trim().toLowerCase()
    const matches = (rows ?? []).filter((r: LeadRow) => {
      const rowAddress = (r.address ?? '').trim().toLowerCase()
      return normKey(r.store_name, r.address) === key || !targetAddress || !rowAddress
    })
    for (const match of matches) {
      if (await isActiveDuplicateLead(match as LeadRow)) return match as LeadRow
    }
  }
  return null
}

/** 地圖 OSM 一鍵加入：先檢查既有開發紀錄，必要時可由使用者確認後仍加入。 */
export async function addLeadFromOsm(
  place: OsmPlace,
  displayName: string,
  opts?: { force?: boolean; ownerName?: string },
): Promise<{ ok: boolean; duplicate: boolean; lead: LeadRow | null; error: string | null }> {
  const osmId = place.osmId?.trim()
  if (!osmId) {
    return { ok: false, duplicate: false, lead: null, error: '缺少 osm_id' }
  }

  if (!opts?.force) {
    const existing = await findExistingLead({
      osmId,
      storeName: displayName,
      address: place.address ?? '',
    })
    if (existing) {
      return { ok: false, duplicate: true, lead: existing, error: null }
    }
  }

  const payload = {
    store_name: displayName.trim() || '未命名店家',
    address: place.address ?? '',
    category: place.category ?? 'restaurant',
    source: 'osm' as const,
    status: 'new' as const,
    owner_name: opts?.ownerName?.trim() || '未指定',
    contact_name: '',
    phone: '',
    line_id: '',
    last_follow_up_at: new Date().toISOString(),
    notes: '',
    osm_id: osmId,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
  }

  const { data, error } = await supabase.from('leads').insert(payload).select('*').single()
  if (error) {
    console.error('[leads] osm insert error:', error)
    return { ok: false, duplicate: false, lead: null, error: error.message }
  }
  console.log('[leads] osm insert ok', { osmId, store_name: payload.store_name })
  return { ok: true, duplicate: false, lead: data as LeadRow, error: null }
}

export async function insertLead(input: LeadInsert): Promise<{ lead: LeadRow | null; error: string | null; duplicate: boolean }> {
  const existing = await findExistingLead({
    osmId: input.osm_id ?? undefined,
    businessId: input.business_id ?? undefined,
    storeName: input.store_name,
    address: input.address,
  })
  if (existing) {
    return { lead: existing, error: null, duplicate: true }
  }

  const { data, error } = await supabase.from('leads').insert(input).select('*').single()
  if (error) return { lead: null, error: error.message, duplicate: false }
  return { lead: data as LeadRow, error: null, duplicate: false }
}

export async function updateLead(id: string, patch: Partial<LeadInsert>): Promise<string | null> {
  const { error } = await supabase.from('leads').update(patch).eq('id', id)
  return error?.message ?? null
}

export async function deleteLead(id: string): Promise<string | null> {
  const { error } = await supabase.from('leads').update({ is_deleted: true }).eq('id', id)
  return error?.message ?? null
}

export function leadFromOsmPlace(
  place: OsmPlace & { distanceKm?: number },
  displayName: string,
  extras?: { ai_summary?: string | null; pitch_email?: string | null; notes?: string },
): LeadInsert {
  return {
    store_name: displayName,
    address: place.address ?? '',
    category: place.category ?? 'restaurant',
    source: 'osm',
    status: 'new',
    owner_name: '',
    contact_name: '',
    phone: '',
    line_id: '',
    last_follow_up_at: null,
    ai_summary: extras?.ai_summary ?? null,
    pitch_email: extras?.pitch_email ?? null,
    notes: extras?.notes ?? '',
    business_id: null,
    osm_id: place.osmId,
    lat: place.lat,
    lng: place.lng,
  }
}

export function leadFromBusiness(
  biz: { id: string; name: string; address: string; category: string; lat?: number; lng?: number },
  extras?: { ai_summary?: string | null; pitch_email?: string | null; notes?: string },
): LeadInsert {
  return {
    store_name: biz.name,
    address: biz.address ?? '',
    category: biz.category ?? 'restaurant',
    source: 'crm',
    status: 'new',
    owner_name: '',
    contact_name: '',
    phone: '',
    line_id: '',
    last_follow_up_at: null,
    ai_summary: extras?.ai_summary ?? null,
    pitch_email: extras?.pitch_email ?? null,
    notes: extras?.notes ?? '',
    business_id: biz.id,
    osm_id: null,
    lat: biz.lat ?? null,
    lng: biz.lng ?? null,
  }
}

export function buildCrmPitchHtml(
  storeName: string,
  reviews: Review[],
  dirs: Record<string, boolean>,
  salesperson = '林○○',
): string {
  return buildEmailBody(storeName, reviews, dirs, salesperson)
}

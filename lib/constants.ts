export type DirKey = 'food' | 'queue' | 'digital' | 'pay'
export type CatId = 'food' | 'queue' | 'digital' | 'pay' | 'none'

export const DIRS: Record<DirKey, { label: string; color: string; bg: string; tc: string; pitch: string; script: string }> = {
  food: {
    label: '🟠 剩食變收入', color: '#C8841A', bg: '#FAEEDA', tc: '#854F0B',
    pitch: '讓原本要丟掉的食材變成營業收入，掃一次條碼零人力處理剩食',
    script: '我看到有客人提到您店裡食材浪費的問題，EatQ 可以讓剩食直接變收入',
  },
  queue: {
    label: '🔵 出餐壓力', color: '#185FA5', bg: '#E6F1FB', tc: '#0C447C',
    pitch: '降低尖峰時段的出餐壓力，讓快過期食材提早賣出減少備料焦慮',
    script: '我注意到客人反映出餐等待時間較長，EatQ 可以幫您在尖峰前就消化多餘備料',
  },
  digital: {
    label: '🟣 數位化第一步', color: '#534AB7', bg: '#EEEDFE', tc: '#3C3489',
    pitch: '用最簡單的條碼掃描開始數位轉型，不需要複雜的系統或培訓',
    script: 'EatQ 是您數位化最簡單的第一步，一個 QR code 就能開始',
  },
  pay: {
    label: '🟡 成本優化', color: '#BA7517', bg: '#FEF9EE', tc: '#633806',
    pitch: '把食材成本損耗降到最低，每一份原本要丟棄的食材都能回收價值',
    script: '我們可以幫您把原本要報廢的食材成本轉換成實際收入',
  },
}

export const CATS: { id: CatId; label: string; color: string; bg: string; tc: string }[] = [
  { id: 'food',    label: '剩食相關', color: '#C8841A', bg: '#FAEEDA', tc: '#854F0B' },
  { id: 'queue',   label: '排隊/出餐', color: '#185FA5', bg: '#E6F1FB', tc: '#0C447C' },
  { id: 'digital', label: '訂位/線上', color: '#534AB7', bg: '#EEEDFE', tc: '#3C3489' },
  { id: 'pay',     label: '付款體驗', color: '#BA7517', bg: '#FEF9EE', tc: '#633806' },
  { id: 'none',    label: '一般評論', color: '#888780', bg: '#F1EFE8', tc: '#5F5E5A' },
]

export interface Review {
  id: string
  business_id: string
  text: string
  category: CatId
}

export interface BusinessRow {
  id: string
  name: string
  category: string
  address: string
  district: string
  city: string
  phone?: string
  email?: string
  google_rating?: number
  review_count?: number
  has_app: boolean
  has_online_ordering: boolean
  has_loyalty_program: boolean
  pain_points: string[]
  lat: number
  lng: number
  tags: string[]
  reviews?: Review[]
}

export interface PipelineRow {
  id: string
  business_id: string
  status: string
  assigned_to: string
  priority: string
  estimated_value: number
  next_follow_up?: string
  notes: string
  contact_name: string
  contact_phone: string
  contact_line: string
  said: boolean
  sent: boolean
  visit_date?: string
  other_user: string
  dirs: Record<string, boolean>
  businesses?: { name: string; address: string; category: string }
  pipeline_messages?: PipelineMessage[]
}

export interface PipelineMessage {
  id: string
  pipeline_id: string
  from_name: string
  message: string
  created_at: string
}

export interface ClientRow {
  id: string
  business_id: string
  contract_start: string
  contract_end?: string
  plan: string
  monthly_value: number
  status: string
  notes: string
  rep_name: string
  contact_phone: string
  contact_line: string
  contact_email: string
  sticker_given: number
  sticker_used: number
  sticker_price: number
  contract_progress: number
  businesses?: { name: string }
}

export interface ChangelogRow {
  id: string
  lead_id?: string
  business_name: string
  field: string
  old_value: string
  new_value: string
  changed_by: string
  changed_at: string
  note?: string
  type: string
  reason: string
}

export function getScore(reviews: Review[]): number {
  if (!reviews || reviews.length === 0) return 0
  const rel = reviews.filter(r => r.category !== 'none')
  return Math.round(rel.length / reviews.length * 100)
}

export function getCatCounts(reviews: Review[]): Record<CatId, number> {
  const c: Record<CatId, number> = { food: 0, queue: 0, digital: 0, pay: 0, none: 0 }
  if (!reviews) return c
  reviews.forEach(r => { if (r.category in c) c[r.category as CatId]++ })
  return c
}

export function buildEmailBody(
  bizName: string,
  reviews: Review[],
  dirs: Record<string, boolean>,
  salesperson: string,
): string {
  const activeDirs = Object.keys(dirs).filter(k => dirs[k]) as DirKey[]
  const pain = reviews.find(r => r.category !== 'none')
  const painText = pain ? pain.text.substring(0, 18) + '…' : '食材管理問題'
  let body = `您好，<br><br>我是 EatQ 業務員 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">${salesperson}</b>。根據顧客評論，我們注意到您店裡有 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">${painText}</b> 的狀況。<br><br>`
  if (activeDirs.length === 0) {
    body += 'EatQ 可以幫助您的店更有效率地營運，目前推廣期提供一年免費試用。<br><br>'
  } else {
    body += 'EatQ 針對您的店提供以下幾點幫助：<br>'
    activeDirs.forEach(k => {
      const d = DIRS[k]
      body += `<br><span style="background:${d.bg};color:${d.tc};padding:1px 5px;border-radius:3px;font-size:11px">${d.label}</span> ${d.pitch}<br>`
    })
    body += '<br>'
  }
  body += `目前推廣期提供 <b style="background:#FAEEDA;color:#854F0B;padding:0 3px">一年完全免費試用</b>，誠摯邀請您體驗。<br><br>請問方便安排 10 分鐘讓我當面說明嗎？<br><br>${salesperson} · EatQ 台南業務`
  return body
}

export function buildScript(
  bizName: string,
  reviews: Review[],
  dirs: Record<string, boolean>,
  salesperson: string,
): string {
  const activeDirs = Object.keys(dirs).filter(k => dirs[k]) as DirKey[]
  const parts = activeDirs.map(k => DIRS[k].script)
  if (parts.length === 0) {
    return `「您好，我是 EatQ 業務員${salesperson}，我們有個方案可以幫助您店的營運效率，請問現在方便聊三分鐘嗎？」`
  }
  return `「您好，請問是${bizName}嗎？我是 EatQ 業務員${salesperson}。<br><br>${parts.join('；<br>')}。<br><br>我們目前推廣期完全免費試用一年，請問現在方便聊三分鐘嗎？」`
}

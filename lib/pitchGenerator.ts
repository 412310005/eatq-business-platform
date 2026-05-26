/** Mock AI 推銷信（之後可替換為 OpenAI） */

export type PitchDirectionId =
  | 'food_waste'
  | 'queue'
  | 'google_reviews'
  | 'delivery'
  | 'membership'
  | 'ai_pain'
  | 'marketing'

export type PitchContent = {
  email: string
  line: string
  ig: string
  call: string
  directionId: PitchDirectionId
  directionLabel: string
}

export const PITCH_DIRECTIONS: { id: PitchDirectionId; label: string; hook: string }[] = [
  { id: 'food_waste', label: '剩食變收入', hook: '把剩食與即期食材轉成可追蹤的營收，減少報廢損失' },
  { id: 'queue', label: '排隊優化', hook: '尖峰排隊與出餐節奏可視化，讓現場更好調度人力' },
  { id: 'google_reviews', label: 'Google評論', hook: '從評論洞察回訪與口碑，把線上聲量變成到店動能' },
  { id: 'delivery', label: '外送導流', hook: '外送與預點導流更順，減少尖峰漏單與備料浪費' },
  { id: 'membership', label: '會員經營', hook: '會員回訪與熟客經營，提高回購而不是只做一次性曝光' },
  { id: 'ai_pain', label: 'AI痛點分析', hook: '用評論與營運數據抓痛點，先對症再談方案' },
  { id: 'marketing', label: '行銷曝光', hook: '在地曝光與活動導流，讓新客願意進店試一次' },
]

const DIRECTION_PREFIX = '【推銷方向】'

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: '餐飲',
  cafe: '咖啡',
  bakery: '烘焙',
  bar: '酒吧',
  night_market: '夜市',
  food: '餐飲',
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category
}

export function getDirectionMeta(id: PitchDirectionId) {
  return PITCH_DIRECTIONS.find(d => d.id === id)!
}

export function parsePitchDirectionFromSummary(summary: string | null | undefined): PitchDirectionId | null {
  if (!summary?.trim()) return null
  const line = summary.split('\n').find(l => l.startsWith(DIRECTION_PREFIX))
  if (!line) return null
  const label = line.replace(DIRECTION_PREFIX, '').trim()
  const hit = PITCH_DIRECTIONS.find(d => d.label === label)
  return hit?.id ?? null
}

export function formatAiSummaryWithDirection(
  directionId: PitchDirectionId,
  existingSummary?: string | null,
): string {
  const label = getDirectionMeta(directionId).label
  const directionLine = `${DIRECTION_PREFIX}${label}`
  const rest = (existingSummary ?? '')
    .split('\n')
    .filter(l => !l.startsWith(DIRECTION_PREFIX))
    .join('\n')
    .trim()
  return rest ? `${directionLine}\n${rest}` : directionLine
}

export function displayAiSummaryText(summary: string | null | undefined): string {
  if (!summary?.trim()) return ''
  return summary
    .split('\n')
    .filter(l => !l.startsWith(DIRECTION_PREFIX))
    .join('\n')
    .trim()
}

/** Mock：四渠道不同語氣 + 依推銷方向客製 */
export function generateMockPitch(
  storeName: string,
  category: string,
  directionId: PitchDirectionId,
  extraContext?: string | null,
): PitchContent {
  const cat = categoryLabel(category)
  const dir = getDirectionMeta(directionId)
  const ctx = extraContext?.trim()
    ? `\n（補充：${extraContext.trim().slice(0, 80)}${extraContext.length > 80 ? '…' : ''}）`
    : ''

  const email = `尊敬的 ${storeName} 負責人您好：

我是 EatQ 業務林○○。我們注意到 ${storeName} 在 ${cat} 領域的經營表現，並希望以「${dir.label}」為切入點與您交流。${ctx}

${dir.hook}。EatQ 可協助：
• 營運數據與現場節奏一目了然
• 降低尖峰壓力與食材浪費
• 推廣期提供一年免費試用，導入門檻低

若您方便，誠摯邀請安排 10–15 分鐘線上或到店說明。期待您的回覆。

敬祝 商祺
林○○ · EatQ 台南業務`

  const line = `您好，我是 EatQ 林○○ 👋
想跟 ${storeName} 聊「${dir.label}」～
${dir.hook.slice(0, 36)}…
推廣期免費試用一年，約 10 分鐘可以嗎？🙏`

  const ig = `👋 ${storeName} 的老闆您好！

我們在做 ${cat} 店的輕量營運小幫手 ✨
這次想聊的主題是：${dir.label}
${dir.hook}

有興趣的話留言或私訊，約個 10 分鐘聊聊～
推廣期免費試用 🎁`

  const call = `【開場】
「您好，請問是 ${storeName} 嗎？我是 EatQ 的林○○。」

【切入】
「我們最近在協助 ${cat} 店家做 ${dir.label}，${dir.hook}。」

【邀約】
「推廣期可以免費試用一年，想請問您這週有没有 3 分鐘，讓我簡單說明？」

【結尾】
「謝謝您，那我傳 LINE 資料給您參考。」`

  return {
    email: email.trim(),
    line: line.trim(),
    ig: ig.trim(),
    call: call.trim(),
    directionId,
    directionLabel: dir.label,
  }
}

export function serializePitch(content: PitchContent): string {
  return JSON.stringify({
    v: 2,
    email: content.email,
    line: content.line,
    ig: content.ig,
    call: content.call,
    directionId: content.directionId,
    directionLabel: content.directionLabel,
  })
}

export function parseStoredPitch(stored: string | null | undefined): PitchContent | null {
  if (!stored?.trim()) return null
  try {
    const j = JSON.parse(stored) as Partial<PitchContent> & { v?: number }
    if (typeof j === 'object' && j !== null) {
      if (j.v === 2 && j.directionId) {
        return {
          email: j.email ?? '',
          line: j.line ?? '',
          ig: j.ig ?? '',
          call: j.call ?? '',
          directionId: j.directionId as PitchDirectionId,
          directionLabel: j.directionLabel ?? getDirectionMeta(j.directionId as PitchDirectionId).label,
        }
      }
      if (j.email || j.line) {
        return {
          email: j.email ?? '',
          line: j.line ?? '',
          ig: j.ig ?? '',
          call: j.call ?? '',
          directionId: 'food_waste',
          directionLabel: '剩食變收入',
        }
      }
    }
  } catch {
    /* 舊版純文字 */
  }
  return {
    email: stored.trim(),
    line: '',
    ig: '',
    call: '',
    directionId: 'food_waste',
    directionLabel: '剩食變收入',
  }
}

export function hasPitch(stored: string | null | undefined): boolean {
  const p = parseStoredPitch(stored)
  if (!p) return false
  return Boolean(
    p.email?.trim() || p.line?.trim() || p.ig?.trim() || p.call?.trim(),
  )
}

export function pitchSummaryLine(stored: string | null | undefined, maxLen = 72): string {
  const p = parseStoredPitch(stored)
  if (!p) return ''
  const prefix = p.directionLabel ? `「${p.directionLabel}」` : ''
  const text = (p.email || p.line || p.ig || p.call).replace(/\s+/g, ' ').trim()
  if (!text) return prefix
  const body = text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
  return prefix ? `${prefix} · ${body}` : body
}

import type { OsmPlace } from '@/lib/overpass'

/** OSM amenity / shop → 業務可讀中文類別 */
const OSM_CATEGORY_ZH: Record<string, string> = {
  restaurant: '餐廳',
  cafe: '咖啡店',
  fast_food: '速食店',
  bar: '酒吧',
  breakfast: '早餐店',
  bakery: '麵包店',
  tea: '飲料店',
  ice_cream: '冰淇淋店',
  food_court: '美食街',
  food: '餐飲店',
}

const PLACEHOLDER_NAMES = new Set([
  '未命名店家',
  '未命名',
  'unnamed',
  'unknown',
  '無名',
  'no name',
])

const RAW_CATEGORY_AS_NAME = new Set(Object.keys(OSM_CATEGORY_ZH))

const ROAD_PARSE_RULES: { re: RegExp; score: number }[] = [
  { re: /([\u4e00-\u9fff]{1,12}大道)/g, score: 40 },
  { re: /([\u4e00-\u9fff]{1,12}路)/g, score: 30 },
  { re: /([\u4e00-\u9fff]{1,12}街)/g, score: 30 },
  { re: /([\u4e00-\u9fff]{1,12}巷)/g, score: 20 },
  { re: /([\u4e00-\u9fff]{1,12}弄)/g, score: 15 },
]

const ROAD_SUFFIX_RE = /[\u4e00-\u9fff]{1,10}(路|街|大道|巷|弄)$/

let osmRawDebugCount = 0
const OSM_RAW_DEBUG_MAX = 8

function normalizeToken(s: string): string {
  return s.trim().toLowerCase()
}

export function isUsableOsmPlaceName(name: string | undefined | null): boolean {
  if (!name?.trim()) return false
  const t = name.trim()
  const lower = normalizeToken(t)
  if (PLACEHOLDER_NAMES.has(lower)) return false
  if (lower.includes('未命名') || lower.includes('unnamed')) return false
  if (RAW_CATEGORY_AS_NAME.has(lower)) return false
  return true
}

export function getOsmCategoryLabel(category: string): string {
  const key = category.trim().toLowerCase()
  return OSM_CATEGORY_ZH[key] ?? '餐飲店'
}

/** 從任意字串擷取路名（路／街／大道／巷／弄） */
export function extractRoadFromText(text: string): string | null {
  const t = text.trim()
  if (!t) return null

  if (ROAD_SUFFIX_RE.test(t) && t.length <= 14) {
    return t
  }

  let best: { text: string; score: number; index: number } | null = null

  for (const { re, score } of ROAD_PARSE_RULES) {
    re.lastIndex = 0
    for (const m of t.matchAll(re)) {
      const text = m[1]?.trim()
      if (!text || text.length > 14) continue
      const index = m.index ?? 0
      if (
        !best ||
        score > best.score ||
        (score === best.score && index > best.index)
      ) {
        best = { text, score, index }
      }
    }
  }

  return best?.text ?? null
}

/** @deprecated 使用 extractRoadFromText */
export const extractRoadFromAddress = extractRoadFromText

/** 從地址擷取行政區（例：東區、北區、中西區） */
export function extractDistrictFromText(text: string): string | null {
  const t = text.trim()
  if (!t) return null

  const matches = [...t.matchAll(/([\u4e00-\u9fff]{1,6}區)/g)]
    .map(m => m[1])
    .filter(d => d !== '市區' && d !== '省區')

  if (matches.length === 0) return null
  return matches[matches.length - 1]
}

export type PlaceForDisplay = Pick<
  OsmPlace,
  'name' | 'address' | 'category' | 'road' | 'roadSource' | 'display_name' | 'tags'
>

export type OsmDisplayNameResult = {
  displayName: string
  rawName: string
  parsedRoad: string | null
  parsedDistrict: string | null
  categoryLabel: string
  rule: 'A' | 'B' | 'C' | 'D'
  roadSource?: string
}

function combinedLocationText(place: PlaceForDisplay): string {
  const tags = place.tags ?? {}
  return [
    place.display_name,
    place.address,
    tags['addr:full'],
    tags['addr:city'],
    tags['addr:district'] || tags['addr:suburb'],
    tags['addr:place'],
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * 路名擷取優先順序：
 * 1. place.road
 * 2. tags['addr:street']
 * 3. tags['addr:road'] / tags.road
 * 4. place.address
 * 5. place.display_name / addr:full
 */
export function parseRoadFromPlace(place: PlaceForDisplay): { road: string | null; source?: string } {
  if (place.road?.trim()) {
    const normalized = extractRoadFromText(place.road) ?? place.road.trim()
    return { road: normalized, source: place.roadSource ?? 'place.road' }
  }

  const tags = place.tags ?? {}

  const candidates: { source: string; text: string }[] = [
    { source: "tags['addr:street']", text: tags['addr:street'] ?? '' },
    { source: 'tags.road', text: tags.road ?? '' },
    {
      source: 'tags.pedestrian',
      text: tags.pedestrian && tags.pedestrian !== 'yes' ? tags.pedestrian : '',
    },
    { source: "tags['addr:road']", text: tags['addr:road'] ?? '' },
    { source: 'place.address', text: place.address ?? '' },
    { source: 'place.display_name', text: place.display_name ?? '' },
    { source: "tags['addr:full']", text: tags['addr:full'] ?? '' },
  ]

  for (const { source, text } of candidates) {
    if (!text.trim()) continue
    const road = extractRoadFromText(text)
    if (road) return { road, source }
  }

  return { road: null }
}

/**
 * 地理辨識型 OSM 顯示名稱
 *
 * A. 真實店名 → 原樣
 * B. 路名 + 類別（例：崇德路咖啡店）
 * C. 區域 + 類別（例：東區餐廳）
 * D. 附近 + 類別（最後 fallback）
 */
export function resolveOsmPlaceDisplayName(place: PlaceForDisplay): OsmDisplayNameResult {
  const rawName = place.name?.trim() ?? ''
  const categoryLabel = getOsmCategoryLabel(place.category)

  const { road: parsedRoad, source: roadSource } = parseRoadFromPlace(place)

  if (!isUsableOsmPlaceName(rawName) && !parsedRoad && osmRawDebugCount < OSM_RAW_DEBUG_MAX) {
    osmRawDebugCount += 1
    console.log('[osm raw]', {
      name: place.name,
      address: place.address,
      road: place.road,
      display_name: place.display_name,
      tags: place.tags,
      fullPlace: place,
    })
  }
  const locationText = combinedLocationText(place)
  const parsedDistrict = locationText ? extractDistrictFromText(locationText) : null

  if (isUsableOsmPlaceName(rawName)) {
    return {
      displayName: rawName,
      rawName,
      parsedRoad,
      parsedDistrict,
      categoryLabel,
      rule: 'A',
      roadSource,
    }
  }

  if (parsedRoad) {
    return {
      displayName: `${parsedRoad}${categoryLabel}`,
      rawName,
      parsedRoad,
      parsedDistrict,
      categoryLabel,
      rule: 'B',
      roadSource,
    }
  }

  if (parsedDistrict) {
    return {
      displayName: `${parsedDistrict}${categoryLabel}`,
      rawName,
      parsedRoad,
      parsedDistrict,
      categoryLabel,
      rule: 'C',
      roadSource,
    }
  }

  return {
    displayName: `附近${categoryLabel}`,
    rawName,
    parsedRoad,
    parsedDistrict,
    categoryLabel,
    rule: 'D',
    roadSource,
  }
}

export function getOsmPlaceDisplayName(place: PlaceForDisplay): string {
  return resolveOsmPlaceDisplayName(place).displayName
}

export function logOsmDisplayName(context: string, place: PlaceForDisplay): OsmDisplayNameResult {
  const resolved = resolveOsmPlaceDisplayName(place)
  console.log(`[osmDisplayName] ${context}`, {
    rawName: resolved.rawName,
    displayName: resolved.displayName,
    parsedRoad: resolved.parsedRoad,
    parsedDistrict: resolved.parsedDistrict,
    categoryLabel: resolved.categoryLabel,
    rule: resolved.rule,
    roadSource: resolved.roadSource,
  })
  return resolved
}

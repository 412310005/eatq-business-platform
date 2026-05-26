export type OsmReview = {
  text: string
  rating: number
  source: string
}

export type OsmPlace = {
  osmId: string
  name: string
  lat: number
  lng: number
  category: string
  /** 組合後的可讀地址 */
  address?: string
  /** 從 tags 直接擷取的路名 */
  road?: string
  /** 路名來源（debug） */
  roadSource?: string
  /** 完整地址（通常 addr:full） */
  display_name?: string
  /** 地址相關 OSM tags（進入前端 state） */
  tags?: Record<string, string>
  reviews: OsmReview[]
}

const OVERPASS_PARSE_LOG_MAX = 10
let overpassParseLogCount = 0

const ROAD_TEXT_RULES = [
  /([\u4e00-\u9fff]{1,12}大道)/,
  /([\u4e00-\u9fff]{1,12}路)/,
  /([\u4e00-\u9fff]{1,12}街)/,
  /([\u4e00-\u9fff]{1,12}巷)/,
  /([\u4e00-\u9fff]{1,12}弄)/,
]

function extractRoadFromText(text: string | undefined): string | undefined {
  const t = text?.trim()
  if (!t) return undefined
  if (/^[\u4e00-\u9fff]{1,12}(路|街|大道|巷|弄)$/.test(t)) return t
  for (const re of ROAD_TEXT_RULES) {
    const m = t.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function pickAddrTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (!v?.trim()) continue
    const kl = k.toLowerCase()
    if (
      k.startsWith('addr:') ||
      k === 'road' ||
      k === 'pedestrian' ||
      k === 'place' ||
      k === 'is_in' ||
      kl.includes('street') ||
      kl.includes('road')
    ) {
      out[k] = v.trim()
    }
  }
  return out
}

function buildAddressFromTags(tags: Record<string, string>): string | undefined {
  const full = tags['addr:full']?.trim()
  if (full) return full

  const parts = [
    tags['addr:postcode'],
    tags['addr:city'],
    tags['addr:district'] || tags['addr:suburb'],
    tags['addr:street'] || tags['addr:road'] || tags.road,
    tags['addr:housenumber'],
  ].filter(Boolean)

  return parts.length > 0 ? parts.join('') : undefined
}

/** 直接從 element.tags 擷取路名（優先 addr:street，不靠 address 字串） */
function extractRoadFromRawTags(tags: Record<string, string>): { road?: string; roadSource?: string } {
  const candidates: { key: string; value: string }[] = [
    { key: 'addr:street', value: tags['addr:street'] ?? '' },
    { key: 'road', value: tags.road ?? '' },
    { key: 'pedestrian', value: tags.pedestrian ?? '' },
    { key: 'addr:road', value: tags['addr:road'] ?? '' },
    { key: 'addr:full', value: tags['addr:full'] ?? '' },
  ]

  for (const { key, value } of candidates) {
    const v = value.trim()
    if (!v || v === 'yes' || v === 'no' || v === 'crossing') continue
    const road = extractRoadFromText(v)
    if (road) return { road, roadSource: `tags.${key}` }
  }

  return {}
}

/** OSM 店家不附 mock 評論；評論由業務在 AI 頁手動貼上 */
export function attachMockOsmReviews(place: OsmPlace): OsmPlace {
  return { ...place, reviews: [] }
}

export function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream|food_court)$"](around:${radiusM},${lat},${lon});
  node["shop"="bakery"](around:${radiusM},${lat},${lon});
  way["shop"="bakery"](around:${radiusM},${lat},${lon});
);
out center tags;`
}

export function summarizeOsmPlaces(places: OsmPlace[]) {
  return {
    total: places.length,
    withRoad: places.filter(p => Boolean(p.road?.trim())).length,
    withAddress: places.filter(p => Boolean(p.address?.trim())).length,
    withDisplayName: places.filter(p => Boolean(p.display_name?.trim())).length,
    withTagAddrStreet: places.filter(p => Boolean(p.tags?.['addr:street'])).length,
    withTagAddrFull: places.filter(p => Boolean(p.tags?.['addr:full'])).length,
    withTagRoad: places.filter(p => Boolean(p.tags?.road)).length,
    withTagPedestrian: places.filter(p => Boolean(p.tags?.pedestrian)).length,
    unnamed: places.filter(p => p.name === '未命名店家').length,
    unnamedWithRoad: places.filter(p => p.name === '未命名店家' && p.road).length,
  }
}

/** 瀏覽器 Console：檢查 API 回傳後真正進入 state 的 payload */
export function logOsmPlacesClientDebug(places: OsmPlace[], label: string) {
  const stats = summarizeOsmPlaces(places)
  console.warn(`[overpass client] ${label} stats`, stats)

  places.slice(0, 8).forEach((place, i) => {
    console.log('[overpass client] sample', i, {
      osmId: place.osmId,
      name: place.name,
      road: place.road,
      roadSource: place.roadSource,
      address: place.address,
      display_name: place.display_name,
      tags: place.tags,
      fullPlace: place,
    })
  })
}

export function parseOverpassElements(elements: unknown[]): OsmPlace[] {
  const seen = new Set<string>()
  const places: OsmPlace[] = []
  overpassParseLogCount = 0

  for (const raw of elements) {
    const el = raw as {
      type?: string
      id?: number
      lat?: number
      lon?: number
      center?: { lat?: number; lon?: number }
      tags?: Record<string, string>
    }
    if (el.type !== 'node' && el.type !== 'way') continue
    if (el.id == null) continue

    const osmId = `${el.type}/${el.id}`
    if (seen.has(osmId)) continue
    seen.add(osmId)

    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue

    const rawTags = el.tags ?? {}
    const tags = pickAddrTags(rawTags)
    const name =
      rawTags.name ||
      rawTags['name:zh'] ||
      rawTags['name:zh-TW'] ||
      rawTags.brand ||
      '未命名店家'

    const address = buildAddressFromTags(rawTags)
    const display_name = rawTags['addr:full']?.trim() || address

    let { road, roadSource } = extractRoadFromRawTags(rawTags)
    if (!road && address) {
      road = extractRoadFromText(address)
      if (road) roadSource = 'built.address'
    }
    if (!road && display_name) {
      road = extractRoadFromText(display_name)
      if (road) roadSource = 'built.display_name'
    }

    const place = attachMockOsmReviews({
      osmId,
      name,
      lat,
      lng: lon,
      category: rawTags.amenity || rawTags.shop || 'food',
      address,
      road,
      roadSource,
      display_name,
      tags,
      reviews: [],
    })

    if (overpassParseLogCount < OVERPASS_PARSE_LOG_MAX) {
      overpassParseLogCount += 1
      console.log('[overpass parsed]', {
        id: place.osmId,
        name: place.name,
        road: place.road,
        roadSource: place.roadSource,
        address: place.address,
        display_name: place.display_name,
        tags: place.tags,
        rawTags,
        fullPlace: place,
      })
    }

    places.push(place)
  }

  console.log('[overpass batch stats]', summarizeOsmPlaces(places))

  return places
}

export async function fetchOverpassPlaces(
  lat: number,
  lng: number,
  radiusM: number
): Promise<OsmPlace[]> {
  const query = buildOverpassQuery(lat, lng, radiusM)
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'EatQ-CRM/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Overpass HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as { elements?: unknown[] }
  return parseOverpassElements(json.elements ?? [])
}

/** 單次查詢最大半徑（公尺），前端再依 1→2→3→4 km 篩選 */
export const OVERPASS_FETCH_RADIUS_M = 4000
export const AREA_RADII_KM = [1, 2, 3, 4] as const
export const AREA_MIN_COUNT = 20

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: '餐廳',
  cafe: '咖啡廳',
  fast_food: '快餐',
  bar: '酒吧',
  ice_cream: '冰淇淋',
  food_court: '美食街',
  bakery: '烘焙',
}

export function formatOsmCategory(category: string): string {
  return CATEGORY_LABEL[category] ?? category
}

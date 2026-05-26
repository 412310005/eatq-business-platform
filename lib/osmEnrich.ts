import type { OsmPlace } from './overpass'

const NOMINATIM_UA = 'EatQ-CRM/1.0 (map-enrichment; contact@eatq.local)'
const MAX_ROAD_MATCH_KM = 0.2
const MAX_NOMINATIM_PER_REQUEST = 30
const NOMINATIM_DELAY_MS = 1100

const ROAD_SUFFIX_RE = /[\u4e00-\u9fff]{1,12}(路|街|大道|巷|弄)/

export type NamedRoadSegment = {
  name: string
  lat: number
  lng: number
  highway?: string
}

export type OsmEnrichStats = {
  total: number
  needed: number
  enrichedByOverpassRoad: number
  enrichedByNominatim: number
  stillMissing: number
  nominatimCalls: number
  nominatimSkipped: number
  namedRoadsFetched: number
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function extractRoadFromText(text: string | undefined): string | undefined {
  const t = text?.trim()
  if (!t) return undefined
  if (/^[\u4e00-\u9fff]{1,12}(路|街|大道|巷|弄)$/.test(t)) return t
  const m = t.match(/([\u4e00-\u9fff]{1,12}(?:路|街|大道|巷|弄))/)
  return m?.[1]
}

function isNamedRoadSegment(name: string): boolean {
  const t = name.trim()
  if (!t || t.length < 2) return false
  return ROAD_SUFFIX_RE.test(t) || /(Road|Street|Avenue)/i.test(t)
}

function needsEnrichment(place: OsmPlace): boolean {
  if (place.road?.trim()) return false
  return true
}

function coordCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** 單次 Overpass：區域內有 name 的 highway ways */
export async function fetchNamedRoadsNear(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<NamedRoadSegment[]> {
  const query = `[out:json][timeout:25];
way["highway"]["name"](around:${radiusM},${lat},${lng});
out center tags;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': NOMINATIM_UA,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    console.warn('[osm enrich] named roads overpass failed', res.status)
    return []
  }

  const json = (await res.json()) as { elements?: unknown[] }
  const roads: NamedRoadSegment[] = []
  const seen = new Set<string>()

  for (const raw of json.elements ?? []) {
    const el = raw as {
      tags?: Record<string, string>
      center?: { lat?: number; lon?: number }
      lat?: number
      lon?: number
    }
    const name = el.tags?.name?.trim() || el.tags?.['name:zh']?.trim()
    if (!name || !isNamedRoadSegment(name)) continue

    const rlat = el.center?.lat ?? el.lat
    const rlng = el.center?.lon ?? el.lon
    if (rlat == null || rlng == null) continue

    const key = `${name}|${rlat.toFixed(5)}|${rlng.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)

    const roadName = extractRoadFromText(name) ?? name
    roads.push({
      name: roadName,
      lat: rlat,
      lng: rlng,
      highway: el.tags?.highway,
    })
  }

  return roads
}

export function findNearestNamedRoad(
  place: Pick<OsmPlace, 'lat' | 'lng'>,
  roads: NamedRoadSegment[],
  maxKm = MAX_ROAD_MATCH_KM,
): { road: string; distanceKm: number } | null {
  let best: { road: string; distanceKm: number } | null = null

  for (const r of roads) {
    const d = haversineKm([place.lat, place.lng], [r.lat, r.lng])
    if (d > maxKm) continue
    if (!best || d < best.distanceKm) {
      best = { road: r.name, distanceKm: d }
    }
  }

  return best
}

type NominatimReverse = {
  display_name?: string
  address?: Record<string, string>
}

async function nominatimReverseRoad(lat: number, lng: number): Promise<{
  road?: string
  address?: string
  display_name?: string
} | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'zh-TW')
  url.searchParams.set('zoom', '18')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': NOMINATIM_UA },
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    console.warn('[osm enrich] nominatim failed', res.status, lat, lng)
    return null
  }

  const data = (await res.json()) as NominatimReverse
  const addr = data.address ?? {}
  const road =
    extractRoadFromText(addr.road) ||
    extractRoadFromText(addr.pedestrian) ||
    extractRoadFromText(addr.footway) ||
    extractRoadFromText(addr.cycleway) ||
    extractRoadFromText(addr.residential) ||
    extractRoadFromText(data.display_name)

  const parts = [
    addr.postcode,
    addr.city || addr.county,
    addr.suburb || addr.city_district || addr.town,
    addr.road,
    addr.house_number,
  ].filter(Boolean)

  return {
    road: road ?? undefined,
    address: parts.length > 0 ? parts.join('') : undefined,
    display_name: data.display_name,
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function applyEnrichment(
  place: OsmPlace,
  road: string,
  source: string,
  extra?: { address?: string; display_name?: string },
): OsmPlace {
  return {
    ...place,
    road,
    roadSource: source,
    address: place.address || extra?.address,
    display_name: place.display_name || extra?.display_name,
    tags: {
      ...place.tags,
      'enrich:road': road,
      'enrich:source': source,
    },
  }
}

/**
 * OSM 資料增強：無 road 時以 Overpass 道路層 + Nominatim reverse 補路名
 */
export async function enrichOsmPlaces(
  places: OsmPlace[],
  center: { lat: number; lng: number },
  radiusM: number,
): Promise<{ places: OsmPlace[]; stats: OsmEnrichStats }> {
  const stats: OsmEnrichStats = {
    total: places.length,
    needed: 0,
    enrichedByOverpassRoad: 0,
    enrichedByNominatim: 0,
    stillMissing: 0,
    nominatimCalls: 0,
    nominatimSkipped: 0,
    namedRoadsFetched: 0,
  }

  const needing = places.filter(needsEnrichment)
  stats.needed = needing.length

  if (needing.length === 0) {
    return { places, stats }
  }

  console.log('[osm enrich] start', { needing: needing.length, total: places.length })

  const namedRoads = await fetchNamedRoadsNear(center.lat, center.lng, radiusM)
  stats.namedRoadsFetched = namedRoads.length
  console.log('[osm enrich] named roads in area', namedRoads.length)

  const nominatimCache = new Map<string, Awaited<ReturnType<typeof nominatimReverseRoad>>>()
  const stillNeedNominatim: OsmPlace[] = []

  const enrichedPlaces = places.map(place => {
    if (!needsEnrichment(place)) return place

    const nearest = findNearestNamedRoad(place, namedRoads)
    if (nearest) {
      stats.enrichedByOverpassRoad += 1
      return applyEnrichment(
        place,
        nearest.road,
        `overpass-highway:${nearest.distanceKm.toFixed(2)}km`,
      )
    }

    stillNeedNominatim.push(place)
    return place
  })

  let nominatimCount = 0
  for (const place of stillNeedNominatim) {
    if (nominatimCount >= MAX_NOMINATIM_PER_REQUEST) {
      stats.nominatimSkipped += 1
      continue
    }

    const key = coordCacheKey(place.lat, place.lng)
    if (!nominatimCache.has(key)) {
      if (nominatimCount > 0) await sleep(NOMINATIM_DELAY_MS)
      nominatimCache.set(key, await nominatimReverseRoad(place.lat, place.lng))
      nominatimCount += 1
      stats.nominatimCalls += 1
    }

    const rev = nominatimCache.get(key)
    if (rev?.road) {
      const idx = enrichedPlaces.findIndex(p => p.osmId === place.osmId)
      if (idx >= 0) {
        enrichedPlaces[idx] = applyEnrichment(
          enrichedPlaces[idx],
          rev.road,
          'nominatim-reverse',
          { address: rev.address, display_name: rev.display_name },
        )
        stats.enrichedByNominatim += 1
      }
    }
  }

  stats.stillMissing = enrichedPlaces.filter(p => needsEnrichment(p)).length

  console.log('[osm enrich] done', stats)

  return { places: enrichedPlaces, stats }
}

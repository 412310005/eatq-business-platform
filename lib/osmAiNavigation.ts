import { resolveOsmPlaceDisplayName } from './osmDisplayName'
import type { OsmPlace } from './overpass'

/** 組出 /dashboard/ai 的 OSM 店家 query（reviews 為 JSON 字串，由 URLSearchParams encode） */
export function buildOsmAiUrl(
  place: OsmPlace & { distanceKm?: number },
  displayNameOverride?: string,
): string {
  const resolved = resolveOsmPlaceDisplayName(place)
  const displayName = displayNameOverride ?? resolved.displayName
  if (typeof window !== 'undefined') {
    console.log('[osmDisplayName] buildOsmAiUrl', {
      rawName: resolved.rawName,
      displayName,
      parsedRoad: resolved.parsedRoad,
      parsedDistrict: resolved.parsedDistrict,
      categoryLabel: resolved.categoryLabel,
      rule: resolved.rule,
      roadSource: resolved.roadSource,
    })
  }
  const q = new URLSearchParams()
  q.set('name', displayName)
  q.set('category', place.category ?? '')
  q.set('address', place.address ?? '')
  q.set('lat', String(place.lat ?? ''))
  q.set('lng', String(place.lng ?? ''))
  if (place.osmId) q.set('osmId', place.osmId)
  let reviewsJson = '[]'
  try {
    reviewsJson = JSON.stringify(place.reviews ?? [])
  } catch {
    reviewsJson = '[]'
  }
  q.set('reviews', reviewsJson)
  return `/dashboard/ai?${q.toString()}`
}

/** @deprecated 使用 buildOsmAiUrl */
export const buildOsmAiDiagnosisUrl = buildOsmAiUrl

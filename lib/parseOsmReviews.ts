import type { OsmReview } from './overpass'

export function parseOsmReviewsQuery(raw: string | null): OsmReview[] {
  if (!raw) return []
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    /* keep raw only */
  }

  for (const json of candidates) {
    try {
      const parsed = JSON.parse(json) as unknown
      if (!Array.isArray(parsed)) continue
      const out: OsmReview[] = []
      for (const item of parsed) {
        if (item == null || typeof item !== 'object') continue
        const r = item as Record<string, unknown>
        if (typeof r.text !== 'string' || typeof r.source !== 'string') continue
        const rating = typeof r.rating === 'number' ? r.rating : Number(r.rating)
        if (!Number.isFinite(rating)) continue
        out.push({ text: r.text, rating, source: r.source })
      }
      return out
    } catch {
      continue
    }
  }
  return []
}

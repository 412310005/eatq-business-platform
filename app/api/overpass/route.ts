import { NextRequest, NextResponse } from 'next/server'
import { enrichOsmPlaces } from '@/lib/osmEnrich'
import { fetchOverpassPlaces, summarizeOsmPlaces } from '@/lib/overpass'

const API_BUILD = 'v13-osm-enrich'

/** Nominatim 限速時 enrich 可能需 30–40s */
export const maxDuration = 120

export async function POST(req: NextRequest) {
  let body: { lat?: unknown; lng?: unknown; radiusM?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const radiusM = Number(body.radiusM ?? 1000)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }
  if (!Number.isFinite(radiusM) || radiusM < 100 || radiusM > 5000) {
    return NextResponse.json({ error: 'radiusM must be 100–5000' }, { status: 400 })
  }

  try {
    const rawPlaces = await fetchOverpassPlaces(lat, lng, radiusM)
    const beforeStats = summarizeOsmPlaces(rawPlaces)

    const { places, stats: enrichStats } = await enrichOsmPlaces(rawPlaces, { lat, lng }, radiusM)
    const afterStats = summarizeOsmPlaces(places)

    console.log('[api/overpass] enrich pipeline', {
      build: API_BUILD,
      before: beforeStats,
      after: afterStats,
      enrichStats,
    })

    return NextResponse.json({
      count: places.length,
      places,
      _debug: { build: API_BUILD, before: beforeStats, after: afterStats, enrichStats },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Overpass request failed'
    console.error('[api/overpass]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

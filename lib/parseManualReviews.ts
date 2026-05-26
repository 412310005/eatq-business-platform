import type { OsmReview } from './overpass'

/** 將 textarea 多行文字切成評論陣列（半人工貼上 Google 評論） */
export function parseManualReviewText(raw: string): OsmReview[] {
  return raw
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(text => ({ text, rating: 0, source: 'manual' }))
}

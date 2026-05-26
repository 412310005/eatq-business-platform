import type { OsmReview } from './overpass'

export const FOOD_WASTE_KEYWORDS = [
  '吃不完',
  '份量太大',
  '剩很多',
  '浪費',
  '打包',
] as const

export type FoodWasteRiskResult = {
  score: number
  matchedKeywords: string[]
  matchedReviews: OsmReview[]
}

export function analyzeFoodWasteRisk(reviews: OsmReview[]): FoodWasteRiskResult {
  const matchedKeywordsSet = new Set<string>()
  const matchedReviews: OsmReview[] = []
  let keywordHits = 0

  for (const review of reviews) {
    let reviewMatched = false
    for (const kw of FOOD_WASTE_KEYWORDS) {
      if (review.text.includes(kw)) {
        matchedKeywordsSet.add(kw)
        keywordHits += 1
        reviewMatched = true
      }
    }
    if (reviewMatched) matchedReviews.push(review)
  }

  const reviewRatio = reviews.length === 0 ? 0 : matchedReviews.length / reviews.length
  const keywordRatio = keywordHits / Math.max(reviews.length * FOOD_WASTE_KEYWORDS.length, 1)
  const score = reviews.length === 0
    ? 0
    : Math.min(100, Math.round(reviewRatio * 60 + keywordRatio * 40))

  return {
    score,
    matchedKeywords: [...matchedKeywordsSet],
    matchedReviews,
  }
}

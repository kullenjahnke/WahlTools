export const OUTLIER_LAST_PRICE_PCT = 40
export const OUTLIER_MEDIAN_PCT = 50

export interface PriceHistoryPoint {
  retailer: string
  price: number
  timestamp: string
}

export interface OutlierResult {
  isOutlier: true
  pct: number          // signed % vs reference
  reference: number    // the price we compared against
  basis: "last" | "median"
}

export function median(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (v.length === 0) return 0
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * Flag an entered price as a likely outlier.
 * Primary rule: > ±OUTLIER_LAST_PRICE_PCT vs the most recent price at the SAME retailer.
 * Fallback (no same-retailer history): > ±OUTLIER_MEDIAN_PCT vs the cross-retailer
 * median of the latest price per retailer. Returns null when not an outlier.
 */
export function detectPriceOutlier(params: {
  retailer: string
  newPrice: number
  history: PriceHistoryPoint[] // all known prices for the product (any retailer)
}): OutlierResult | null {
  const { retailer, newPrice, history } = params
  if (!Number.isFinite(newPrice) || newPrice <= 0) return null

  const byNewest = [...history]
    .filter((h) => h.price > 0)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const sameRetailer = byNewest.filter((h) => h.retailer === retailer)
  if (sameRetailer.length > 0) {
    const reference = sameRetailer[0].price
    const pct = ((newPrice - reference) / reference) * 100
    return Math.abs(pct) > OUTLIER_LAST_PRICE_PCT
      ? { isOutlier: true, pct, reference, basis: "last" }
      : null
  }

  const latestByRetailer = new Map<string, number>()
  for (const h of byNewest) {
    if (!latestByRetailer.has(h.retailer)) latestByRetailer.set(h.retailer, h.price)
  }
  const med = median([...latestByRetailer.values()])
  if (!med) return null
  const pct = ((newPrice - med) / med) * 100
  return Math.abs(pct) > OUTLIER_MEDIAN_PCT
    ? { isOutlier: true, pct, reference: med, basis: "median" }
    : null
}

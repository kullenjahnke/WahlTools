// Retailer price-competitiveness: how a retailer's prices compare against the
// all-retailer median for the same matched products. A positive score means the
// retailer is, on average, cheaper than the market (more competitive); a
// negative score means pricier. Used by the Prices retailer cards and the
// head-to-head Comparison page.

export interface CompetitivenessPoint {
  productId: string;
  retailer: string;
  price: number;
  categoryId?: string | null;
}

export interface CategoryCompetitiveness {
  categoryId: string | null;
  /** Average % below the market median (positive = cheaper than market). */
  score: number;
  /** Number of matched products contributing to the score. */
  count: number;
}

export interface RetailerCompetitiveness {
  /** Average % below the market median across all matched products. */
  score: number;
  /** Products where this retailer and at least one other retailer have a price. */
  matchedProducts: number;
  byCategory: CategoryCompetitiveness[];
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute competitiveness for a single retailer. For each product the retailer
 * carries, we take the median price across all retailers that carry it (needs
 * at least one other retailer to be a meaningful comparison) and measure the
 * retailer's relative position: (median - retailerPrice) / median.
 */
export function computeRetailerCompetitiveness(
  points: CompetitivenessPoint[],
  retailer: string
): RetailerCompetitiveness {
  // Group prices by product.
  const byProduct = new Map<
    string,
    { categoryId: string | null; prices: { retailer: string; price: number }[] }
  >();
  for (const p of points) {
    if (!Number.isFinite(p.price) || p.price <= 0) continue;
    let entry = byProduct.get(p.productId);
    if (!entry) {
      entry = { categoryId: p.categoryId ?? null, prices: [] };
      byProduct.set(p.productId, entry);
    }
    entry.prices.push({ retailer: p.retailer, price: p.price });
  }

  const perProduct: { categoryId: string | null; relative: number }[] = [];
  for (const { categoryId, prices } of byProduct.values()) {
    const mine = prices.find((x) => x.retailer === retailer);
    if (!mine) continue;
    // Need at least one competing retailer for a meaningful comparison.
    const others = prices.filter((x) => x.retailer !== retailer);
    if (others.length === 0) continue;
    const marketMedian = median(prices.map((x) => x.price));
    if (!Number.isFinite(marketMedian) || marketMedian <= 0) continue;
    perProduct.push({
      categoryId,
      relative: (marketMedian - mine.price) / marketMedian,
    });
  }

  const matchedProducts = perProduct.length;
  const score = matchedProducts
    ? (perProduct.reduce((sum, x) => sum + x.relative, 0) / matchedProducts) * 100
    : 0;

  // Per-category rollup.
  const catMap = new Map<string | null, number[]>();
  for (const { categoryId, relative } of perProduct) {
    const arr = catMap.get(categoryId) ?? [];
    arr.push(relative);
    catMap.set(categoryId, arr);
  }
  const byCategory: CategoryCompetitiveness[] = [...catMap.entries()]
    .map(([categoryId, rels]) => ({
      categoryId,
      score: (rels.reduce((s, r) => s + r, 0) / rels.length) * 100,
      count: rels.length,
    }))
    .sort((a, b) => b.score - a.score);

  return { score, matchedProducts, byCategory };
}

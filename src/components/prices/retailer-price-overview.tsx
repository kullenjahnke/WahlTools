import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { RETAILERS } from "@/lib/config/retailers"
import { RETAILER_COLOR_MAP, BRAND_COLORS } from "@/lib/config/colors"
import { Product, Price } from "@/types/database"
import { ArrowDown, ArrowUp, Clock, ShoppingBag } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
  computeRetailerCompetitiveness,
  type CompetitivenessPoint,
} from "@/lib/competitiveness"
import { cn } from "@/lib/utils"
import { RETAILER_ICONS } from "@/components/icons/retailers"

interface RetailerStats {
  retailer: string
  totalProducts: number
  downOver10: number
  down5to10: number
  down0to5: number
  up0to5: number
  up5to10: number
  upOver10: number
}

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface RetailerPriceOverviewProps {
  products: ProductWithPrices[]
  priceStats?: RetailerStats[]
}

// Build one point per (product, retailer) using the latest in-stock, priced
// record for that pair. Feeds the competitiveness comparison.
function buildCompetitivenessPoints(
  products: ProductWithPrices[]
): CompetitivenessPoint[] {
  const points: CompetitivenessPoint[] = []
  for (const product of products) {
    const latestByRetailer = new Map<string, Price>()
    for (const price of product.prices || []) {
      if (!price || price.is_sold_out || price.price <= 0) continue
      const current = latestByRetailer.get(price.retailer)
      if (
        !current ||
        new Date(price.timestamp).getTime() > new Date(current.timestamp).getTime()
      ) {
        latestByRetailer.set(price.retailer, price)
      }
    }
    for (const [retailer, price] of latestByRetailer) {
      points.push({
        productId: product.id,
        retailer,
        price: price.price,
        categoryId: product.category_id,
      })
    }
  }
  return points
}

export function RetailerPriceOverview({ products, priceStats }: RetailerPriceOverviewProps) {
  // If we have no product data, return early with an empty placeholder
  if (!products || products.length === 0) {
    return (
      <div className="w-full p-4 text-center text-muted-foreground">
        No product data available. Add products and price data to see overview stats.
      </div>
    );
  }

  // Use pre-calculated stats from server action, or build basic stats from products
  const stats = priceStats || RETAILERS.map(retailer => {
    // Count distinct products with prices for this retailer
    const productsWithPrices = products.filter(product => {
      const prices = product.prices?.filter(p => p && p.retailer === retailer) || []
      return prices.length > 0
    })

    return {
      retailer,
      totalProducts: productsWithPrices.length,
      downOver10: 0, down5to10: 0, down0to5: 0,
      up0to5: 0, up5to10: 0, upOver10: 0,
    }
  })

  // Competitiveness: each retailer's prices vs the all-retailer median for the
  // same matched products. Positive = cheaper than market.
  const competitivenessPoints = buildCompetitivenessPoints(products)

  // Find the latest update for each retailer
  const latestUpdates = RETAILERS.map(retailer => {
    const allPrices = products.flatMap(p =>
      p.prices?.filter(price => price && price.retailer === retailer) || []
    )

    if (allPrices.length === 0) return { retailer, lastUpdated: null }

    const latest = allPrices.reduce((latest, current) =>
      !latest || (current && current.timestamp && new Date(current.timestamp) > new Date(latest.timestamp))
        ? current
        : latest
    , allPrices[0])

    return { retailer, lastUpdated: latest?.timestamp }
  })

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-lg">
      <div className="flex w-max space-x-4 pb-4">
        {stats.map((retailerStats) => {
          const { retailer, totalProducts, downOver10, down5to10, down0to5, up0to5, up5to10, upOver10 } = retailerStats
          const lastUpdate = latestUpdates.find(u => u.retailer === retailer)?.lastUpdated
          const competitiveness = computeRetailerCompetitiveness(competitivenessPoints, retailer)
          const score = competitiveness.score
          // Within ±0.5% we treat as "at market" (neutral).
          const direction = competitiveness.matchedProducts === 0
            ? "none"
            : score > 0.5
              ? "cheaper"
              : score < -0.5
                ? "pricier"
                : "even"

          // Calculate percentages for the 6-bucket chart
          const total = downOver10 + down5to10 + down0to5 + up0to5 + up5to10 + upOver10
          // Neutral monochrome ramp (most-down = solid foreground → most-up = faint).
          const buckets = [
            { count: downOver10, pct: total > 0 ? (downOver10 / total) * 100 : 0, color: 'bg-foreground', label: '> 10% down' },
            { count: down5to10, pct: total > 0 ? (down5to10 / total) * 100 : 0, color: 'bg-foreground/75', label: '5-10% down' },
            { count: down0to5, pct: total > 0 ? (down0to5 / total) * 100 : 0, color: 'bg-foreground/50', label: '0-5% down' },
            { count: up0to5, pct: total > 0 ? (up0to5 / total) * 100 : 0, color: 'bg-foreground/35', label: '0-5% up' },
            { count: up5to10, pct: total > 0 ? (up5to10 / total) * 100 : 0, color: 'bg-foreground/25', label: '5-10% up' },
            { count: upOver10, pct: total > 0 ? (upOver10 / total) * 100 : 0, color: 'bg-foreground/15', label: '> 10% up' },
          ]

          // Get the appropriate icon component for this retailer
          const IconComponent = RETAILER_ICONS[retailer]

          return (
            <Card key={retailer} className="w-[300px] overflow-hidden">
              <CardHeader className="flex items-center justify-center py-3">
                <CardTitle className="flex w-full items-center justify-center text-base font-semibold">
                  {IconComponent ? (
                    <div className="flex h-9 items-center justify-center">
                      <IconComponent className="h-7 w-auto" />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <ShoppingBag
                        className="mr-2 h-5 w-5"
                        style={{ color: RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.chart.blue }}
                      />
                      {retailer}
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                {/* Headline: competitiveness vs market, plus products tracked */}
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">vs. market price</span>
                    {direction === "none" ? (
                      <span className="mt-1 text-2xl font-bold text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums",
                          direction === "cheaper" && "text-emerald-600 dark:text-emerald-400",
                          direction === "pricier" && "text-destructive",
                          direction === "even" && "text-foreground"
                        )}
                      >
                        {direction === "cheaper" && <ArrowDown className="h-5 w-5" />}
                        {direction === "pricier" && <ArrowUp className="h-5 w-5" />}
                        {Math.abs(score).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground">Products</span>
                    <span className="mt-1 text-2xl font-bold tabular-nums">{totalProducts}</span>
                  </div>
                </div>

                {/* Price-change distribution bar */}
                <div>
                  <div className="mb-2 text-xs text-muted-foreground">Price changes</div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {buckets.map((bucket, i) => bucket.pct > 0 && (
                      <div
                        key={i}
                        className={`h-full ${bucket.color}`}
                        style={{ width: `${bucket.pct}%` }}
                        title={`${bucket.label}: ${bucket.count}`}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <div className="flex items-center">
                      <div className="mr-1.5 h-2.5 w-2.5 rounded-full bg-foreground"></div>
                      <span>Down: {downOver10 + down5to10 + down0to5}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="mr-1.5 h-2.5 w-2.5 rounded-full bg-foreground/35"></div>
                      <span>Flat: {up0to5}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="mr-1.5 h-2.5 w-2.5 rounded-full bg-foreground/15"></div>
                      <span>Up: {up5to10 + upOver10}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 opacity-70" />
                  {lastUpdate ? (
                    <span>Updated {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}</span>
                  ) : (
                    <span>No data</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

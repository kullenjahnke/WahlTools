import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PriceCheckForm } from "@/components/prices/price-check-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { RETAILERS, RETAILER_COLORS, orderRetailers } from "@/lib/config/retailers"
import { Card, CardContent } from "@/components/ui/card"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { getRetailerCheckStatus } from "@/app/actions/prices"
import type { PriceHistoryPoint } from "@/lib/outlier"
import type { ProductUrl } from "@/types/database"
import { Check } from "lucide-react"

// How far back to load prices for carry-over + outlier context
const HISTORY_LOOKBACK_DAYS = 120

interface PageProps {
  searchParams: Promise<{ retailer?: string }>
}

export const metadata = { title: "WahlTools | Record Prices" }

export default async function PriceCheckPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  try {
    const since = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const [productsResult, categoriesResult, pricesResult, checkStatus] = await Promise.all([
      supabase
        .from('products')
        .select(`*, product_urls (*)`)
        .order('name'),
      supabase
        .from('product_categories')
        .select('id, name'),
      supabase
        .from('prices')
        .select('product_id, retailer, price, timestamp, original_price, is_promotion')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false }),
      getRetailerCheckStatus(),
    ])

    if (productsResult.error) {
      console.error('Error fetching products:', productsResult.error)
      throw new Error(`Failed to fetch products: ${productsResult.error.message}`)
    }

    if (categoriesResult.error) {
      console.error('Error fetching categories:', categoriesResult.error)
      throw new Error(`Failed to fetch categories: ${categoriesResult.error.message}`)
    }

    // Create a map of category IDs to names
    const categoryMap = new Map(
      categoriesResult.data?.map(cat => [cat.id, cat.name]) || []
    )

    // Get unique retailers from product URLs, ordered canonically
    const availableRetailers = Array.from(new Set(
      productsResult.data?.flatMap(product =>
        product.product_urls?.map((url: ProductUrl) => url.retailer) || []
      ) || []
    )).filter(Boolean)

    // Only retailers that have >=1 product URL, in canonical config order
    const retailersToShow = availableRetailers.length > 0
      ? orderRetailers(availableRetailers)
      : (RETAILERS as readonly string[]).slice()

    // Decode the retailer parameter if it exists
    const selectedRetailer = typeof params.retailer === 'string'
      ? decodeURIComponent(params.retailer)
      : retailersToShow[0] || RETAILERS[0]

    const selectedRetailerExists = retailersToShow.includes(selectedRetailer)
    const effectiveRetailer = selectedRetailerExists
      ? selectedRetailer
      : (retailersToShow[0] || RETAILERS[0])

    // Build per-product history map
    const historyByProduct = new Map<string, PriceHistoryPoint[]>()
    for (const row of pricesResult.data || []) {
      if (!row.price || row.price <= 0) continue
      const arr = historyByProduct.get(row.product_id) || []
      arr.push({ retailer: row.retailer, price: row.price, timestamp: row.timestamp })
      historyByProduct.set(row.product_id, arr)
    }

    // Newest positive-price record per product at the effective retailer (for last-week carry, incl. promo).
    const lastEntryByProduct = new Map<string, { price: number; original_price: number | null; is_promotion: boolean }>()
    for (const row of (pricesResult.data || []) as Array<{
      product_id: string; retailer: string; price: number | null; original_price: number | null; is_promotion: boolean | null
    }>) {
      if (row.retailer !== effectiveRetailer) continue
      if (!row.price || row.price <= 0) continue
      if (!lastEntryByProduct.has(row.product_id)) {
        lastEntryByProduct.set(row.product_id, { price: row.price, original_price: row.original_price ?? null, is_promotion: row.is_promotion ?? false })
      }
    }

    // Format the products data correctly with proper typing and add category names
    const formattedProducts = productsResult.data?.map(product => {
      // Filter URLs for the selected retailer
      const relevantUrls = product.product_urls
        ? product.product_urls
            .filter((url: ProductUrl) => url.retailer === effectiveRetailer)
            .map((url: ProductUrl) => ({
              retailer: url.retailer,
              url: url.url
            }))
        : []

      // History (outlier context) + last entry at this retailer (for carry-over)
      const history = historyByProduct.get(product.id) || []
      const lastEntry = lastEntryByProduct.get(product.id) ?? null

      return {
        id: product.id,
        name: product.name,
        category: categoryMap.get(product.category_id) || 'Uncategorized',
        brandName: (product.brand_name as string | null) || null,
        urls: relevantUrls,
        lastPrice: lastEntry?.price ?? null,
        lastOriginalPrice: lastEntry?.original_price ?? null,
        lastWasPromo: lastEntry?.is_promotion ?? false,
        history,
      }
    }) || []

    // Get products with URLs
    const productsWithUrls = formattedProducts.filter(product =>
      product.urls && product.urls.length > 0
    )

    return (
      <PageContainer>
        <PageHeader
          title="Record Prices"
          breadcrumbs={[
            { label: "Prices", href: "/dashboard/prices" },
            { label: "Record prices" },
          ]}
        />

        <div className="grid gap-6">
          {/* Done-state retailer tab bar */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {retailersToShow.map(retailer => {
              const isDone = !!checkStatus[retailer]
              const isActive = retailer === effectiveRetailer
              const color = RETAILER_COLORS[retailer] || '#64748b'

              return (
                <Link
                  key={retailer}
                  href={`/dashboard/prices/check?retailer=${encodeURIComponent(retailer)}`}
                  className={[
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3 py-[7px] text-[13px] font-medium transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : isDone
                        ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                        : "border-border bg-card text-foreground hover:bg-accent/60",
                  ].join(' ')}
                >
                  {isDone ? (
                    <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-brand">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className="h-[7px] w-[7px] rounded-full shrink-0"
                      style={{ backgroundColor: isActive ? 'currentColor' : color }}
                    />
                  )}
                  {retailer}
                </Link>
              )
            })}
          </div>

          {productsWithUrls.length > 0 ? (
            <PriceCheckForm
              key={effectiveRetailer}
              products={productsWithUrls}
              retailer={effectiveRetailer}
              orderedRetailers={retailersToShow}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4">
                  You need to add products before you can record prices.
                </p>
                <Button asChild>
                  <Link href="/dashboard/products/new">
                    Add Product
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    )
  } catch (error) {
    console.error('Error in PriceCheckPage:', error)
    return (
      <PageContainer>
        <PageHeader
          title="Record Prices"
          breadcrumbs={[
            { label: "Prices", href: "/dashboard/prices" },
            { label: "Record prices" },
          ]}
        />
        <div className="p-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
          <h2 className="text-lg font-medium mb-2">Error Loading Products</h2>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        </div>
      </PageContainer>
    )
  }
}

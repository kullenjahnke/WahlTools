import { createSupabaseServerClient } from "@/lib/supabase/server"
import { SequentialPriceEntry } from "@/components/prices/sequential-price-entry"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { RETAILERS, orderRetailers } from "@/lib/config/retailers"
import { getRetailerCheckStatus } from "@/app/actions/prices"
import type { PriceHistoryPoint } from "@/lib/outlier"
import type { ProductUrl, ProductImage } from "@/types/database"

export const metadata = { title: "WahlTools | Sequential Entry" }

const HISTORY_LOOKBACK_DAYS = 120

export default async function SequentialEntryPage() {
  const supabase = await createSupabaseServerClient()

  try {
    const since = new Date(
      Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    const [productsResult, categoriesResult, pricesResult, checkStatus] =
      await Promise.all([
        supabase
          .from("products")
          .select("*, product_urls (*), product_images (*)")
          .order("name"),
        supabase.from("product_categories").select("id, name"),
        supabase
          .from("prices")
          .select("product_id, retailer, price, timestamp")
          .gte("timestamp", since)
          .order("timestamp", { ascending: false }),
        getRetailerCheckStatus(),
      ])

    if (productsResult.error) {
      throw new Error(`Failed to fetch products: ${productsResult.error.message}`)
    }
    if (categoriesResult.error) {
      throw new Error(`Failed to fetch categories: ${categoriesResult.error.message}`)
    }
    if (pricesResult.error) {
      throw new Error(`Failed to fetch prices: ${pricesResult.error.message}`)
    }

    const categoryMap = new Map(
      categoriesResult.data?.map((cat) => [cat.id, cat.name]) || []
    )

    // Build per-product history map (skip price <= 0)
    const historyByProduct = new Map<string, PriceHistoryPoint[]>()
    for (const row of pricesResult.data || []) {
      if (!row.price || row.price <= 0) continue
      const arr = historyByProduct.get(row.product_id) || []
      arr.push({ retailer: row.retailer, price: row.price, timestamp: row.timestamp })
      historyByProduct.set(row.product_id, arr)
    }

    const products = (productsResult.data || []).map((product) => {
      // Resolve image URL: prefer main image, else first, else null
      const images: ProductImage[] = product.product_images || []
      const mainImage = images.find((img: ProductImage) => img.main)
      const imageUrl = (mainImage || images[0])?.url ?? null

      // Build full history for this product, newest-first
      const history = (historyByProduct.get(product.id) || []).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      // Build per-retailer last price map (keep first = newest per retailer)
      const lastPriceByRetailer: Record<string, number> = {}
      for (const h of history) {
        if (!(h.retailer in lastPriceByRetailer)) {
          lastPriceByRetailer[h.retailer] = h.price
        }
      }

      return {
        id: product.id,
        name: product.name,
        category: categoryMap.get(product.category_id) || "Uncategorized",
        brandName: (product.brand_name as string | null) ?? null,
        imageUrl,
        urls: (product.product_urls || []).map((u: ProductUrl) => ({
          retailer: u.retailer,
          url: u.url,
        })),
        history,
        lastPriceByRetailer,
      }
    })

    // Retailers that have >= 1 product URL, in canonical config order
    const withUrls = orderRetailers(
      Array.from(new Set(products.flatMap((p) => p.urls.map((u: { retailer: string; url: string }) => u.retailer))))
    )

    return (
      <PageContainer>
        <PageHeader
          title="Sequential Price Entry"
          breadcrumbs={[
            { label: "Prices", href: "/dashboard/prices" },
            { label: "Sequential entry" },
          ]}
        />
        <SequentialPriceEntry
          products={products}
          retailers={withUrls.length ? withUrls : [...RETAILERS]}
          checkStatus={checkStatus}
        />
      </PageContainer>
    )
  } catch (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Sequential Price Entry"
          breadcrumbs={[
            { label: "Prices", href: "/dashboard/prices" },
            { label: "Sequential entry" },
          ]}
        />
        <div className="p-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
          <h2 className="text-lg font-medium mb-2">Error Loading Products</h2>
          <p>{error instanceof Error ? error.message : "An unexpected error occurred"}</p>
        </div>
      </PageContainer>
    )
  }
}

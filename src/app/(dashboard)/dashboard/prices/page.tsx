import { Suspense } from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getPriceChangeStats } from "@/app/actions/prices"
import { RetailerPriceOverview } from "@/components/prices/retailer-price-overview"
import { RetailerPriceTable } from "@/components/prices/retailer-price-table"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import Link from "next/link"
import { Plus, History, Bell, ListOrdered } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportModal } from "@/components/prices/export-modal"

// Loading state component
function PricesTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Product data loader component
async function ProductsDataLoader() {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Fetch products and categories in parallel
    const [productsResponse, categoriesResponse] = await Promise.all([
      supabase
        .from('products')
        .select(`
          *,
          prices (*),
          product_urls (*)
        `)
        .order('name')
        .limit(500),
      supabase
        .from('product_categories')
        .select('id, name')
        .order('name')
    ])

    // Handle errors
    if (productsResponse.error) {
      console.error('Error fetching products:', productsResponse.error)
      throw productsResponse.error
    }

    // Products directly from the database
    const products = productsResponse.data || []
    const categories = categoriesResponse.data || []

    // Fetch price stats (increases/decreases)
    let priceStats;
    try {
      priceStats = await getPriceChangeStats()
    } catch (statsError) {
      console.error('Error fetching price stats:', statsError)
      // Continue with null stats
    }

    return (
      <>
        <RetailerPriceOverview
          products={products}
          priceStats={priceStats}
        />

        <RetailerPriceTable
          products={products}
          categories={categories}
          exportSlot={<ExportModal products={products} categories={categories} />}
        />
      </>
    )
  } catch (error) {
    console.error('Error in ProductsDataLoader:', error)
    return (
      <div className="p-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
        An unexpected error occurred. Please try refreshing the page.
        {error instanceof Error && <p className="mt-2 text-sm">{error.message}</p>}
      </div>
    )
  }
}

export const metadata = { title: "WahlTools | Prices" }

export default async function PricesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Prices"
        actions={
          <>
            <IconButton
              label="Sequential entry"
              href="/dashboard/prices/sequential"
              icon={<ListOrdered className="size-4" />}
              variant="outline"
            />
            <IconButton
              label="Price history"
              href="/dashboard/prices/history"
              icon={<History className="size-4" />}
              variant="outline"
            />
            <IconButton
              label="Reminders"
              href="/dashboard/prices/reminders"
              icon={<Bell className="size-4" />}
              variant="outline"
            />
            <Button asChild>
              <Link href="/dashboard/prices/check">
                <Plus className="size-4" />
                Record prices
              </Link>
            </Button>
          </>
        }
      />

      <Suspense fallback={<PricesTableSkeleton />}>
        <ProductsDataLoader />
      </Suspense>
    </PageContainer>
  )
}
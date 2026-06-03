import { Suspense } from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getPriceChangeStats } from "@/app/actions/prices"
import { RetailerPriceOverview } from "@/components/prices/retailer-price-overview"
import { RetailerPriceTable } from "@/components/prices/retailer-price-table"
import { PriceHistoryChart } from "@/components/prices/price-history-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, History, Bell, BarChart4, ListOrdered } from "lucide-react"
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
        <div className="flex justify-end">
          <ExportModal products={products} categories={categories} />
        </div>

        <RetailerPriceOverview
          products={products}
          priceStats={priceStats}
        />

        <Tabs defaultValue="table" className="space-y-4">
          <TabsList>
            <TabsTrigger value="table">Price Table</TabsTrigger>
            <TabsTrigger value="trends">Price Trends</TabsTrigger>
          </TabsList>
          <TabsContent value="table" className="space-y-4">
            <RetailerPriceTable products={products} />
          </TabsContent>
          <TabsContent value="trends" className="space-y-4">
            <PriceHistoryChart products={products} />
          </TabsContent>
        </Tabs>
      </>
    )
  } catch (error) {
    console.error('Error in ProductsDataLoader:', error)
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg">
        An unexpected error occurred. Please try refreshing the page.
        {error instanceof Error && <p className="mt-2 text-sm">{error.message}</p>}
      </div>
    )
  }
}

export default async function PricesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Prices</h1>
          <p className="text-muted-foreground">
            Manage and monitor product prices across retailers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/prices/reminders">
              <Bell className="h-4 w-4 mr-2" />
              Reminders
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/prices/history">
              <History className="h-4 w-4 mr-2" />
              History
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/analytics">
              <BarChart4 className="h-4 w-4 mr-2" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/prices/sequential">
              <ListOrdered className="h-4 w-4 mr-2" />
              Sequential Entry
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/prices/check">
              <Plus className="h-4 w-4 mr-2" />
              Record Prices
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<PricesTableSkeleton />}>
        <ProductsDataLoader />
      </Suspense>
    </div>
  )
}
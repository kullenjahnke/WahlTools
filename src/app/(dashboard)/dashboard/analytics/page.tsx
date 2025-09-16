import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PriceTrendsChart } from "@/components/analytics/price-trends-chart"
import { RetailerComparison } from "@/components/analytics/retailer-comparison"
import { CategoryAnalysis } from "@/components/analytics/category-analysis"
import { PriceChangePatterns } from "@/components/analytics/price-change-patterns"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient()
  
  const { data: products } = await supabase
  .from('products')
  .select(`
    *,
    prices (
      id,
      retailer,
      price,
      timestamp,
      status,
      is_promotion,
      promotion_notes
    )
  `)
    .order('name')

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Price Analytics</h1>
          <p className="text-muted-foreground">
            Analyze price trends and patterns across retailers
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PriceTrendsChart products={products || []} />
        <RetailerComparison products={products || []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryAnalysis products={products || []} />
        <PriceChangePatterns products={products || []} />
      </div>
    </div>
  )
}
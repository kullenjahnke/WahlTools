import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductAnalytics } from "@/components/analytics/product-analytics"

export const metadata = { title: "Analytics" }

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
      <div>
        <h1 className="text-3xl font-bold">Price Analytics</h1>
        <p className="text-muted-foreground">
          Select a product to analyze price trends across retailers
        </p>
      </div>

      <ProductAnalytics products={products || []} />
    </div>
  )
}

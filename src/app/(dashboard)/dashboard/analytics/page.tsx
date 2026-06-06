import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductAnalytics } from "@/components/analytics/product-analytics"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Analytics" }

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
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
      .order('name'),
    supabase.from('product_categories').select('id, name').order('name'),
  ])

  return (
    <PageContainer>
      <PageHeader title="Analytics" />
      <ProductAnalytics products={products || []} categories={categories || []} />
    </PageContainer>
  )
}

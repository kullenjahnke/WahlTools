import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { ProductImage } from "@/types/database"
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
        ),
        product_images ( url, main )
      `)
      .order('name'),
    supabase.from('product_categories').select('id, name').order('name'),
  ])

  const withImages = (products || []).map((product) => {
    const images = (product.product_images ?? []) as ProductImage[]
    const imageUrl = (images.find((im) => im.main) || images[0])?.url ?? null
    return { ...product, imageUrl }
  })

  return (
    <PageContainer>
      <PageHeader title="Analytics" />
      <ProductAnalytics products={withImages} categories={categories || []} />
    </PageContainer>
  )
}

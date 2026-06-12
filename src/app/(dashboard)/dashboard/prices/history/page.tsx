import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductHistoryView } from "@/components/prices/product-history-view"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "Price History" }

export default async function PriceHistoryPage() {
  const supabase = await createSupabaseServerClient()

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(`*, prices (*), product_images (*)`)
      .order("name"),
    supabase.from("product_categories").select("id, name"),
  ])

  const categoryMap = new Map(
    (categoriesResult.data || []).map((c) => [c.id, c.name])
  )

  const products = (productsResult.data || []).map((product) => {
    const images = (product.product_images || []) as { url: string; main: boolean }[]
    const imageUrl = (images.find((im) => im.main) || images[0])?.url ?? null
    return {
      ...product,
      imageUrl,
      categoryName: categoryMap.get(product.category_id) ?? null,
    }
  })

  return (
    <PageContainer>
      <PageHeader
        title="Price History"
        breadcrumbs={[
          { label: "Prices", href: "/dashboard/prices" },
          { label: "History" },
        ]}
      />
      <ProductHistoryView products={products} />
    </PageContainer>
  )
}

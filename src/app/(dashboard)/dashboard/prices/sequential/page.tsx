import { createSupabaseServerClient } from "@/lib/supabase/server"
import { SequentialPriceEntry } from "@/components/prices/sequential-price-entry"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import type { ProductUrl } from "@/types/database"

export const metadata = { title: "WahlTools | Sequential Entry" }

export default async function SequentialEntryPage() {
  const supabase = await createSupabaseServerClient()

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_urls (*)")
      .order("name"),
    supabase
      .from("product_categories")
      .select("id, name"),
  ])

  if (productsResult.error) {
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
          <p>Error loading products: {productsResult.error.message}</p>
        </div>
      </PageContainer>
    )
  }

  const categoryMap = new Map(
    categoriesResult.data?.map((cat) => [cat.id, cat.name]) || []
  )

  const products = (productsResult.data || []).map((product) => ({
    id: product.id,
    name: product.name,
    category: categoryMap.get(product.category_id) || "Uncategorized",
    urls: (product.product_urls || []).map((u: ProductUrl) => ({
      retailer: u.retailer,
      url: u.url,
    })),
  }))

  return (
    <PageContainer>
      <PageHeader
        title="Sequential Price Entry"
        breadcrumbs={[
          { label: "Prices", href: "/dashboard/prices" },
          { label: "Sequential entry" },
        ]}
      />
      <SequentialPriceEntry products={products} />
    </PageContainer>
  )
}

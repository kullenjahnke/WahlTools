import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductUrlManager } from "@/components/products/product-url-manager"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Product URLs" }

export default async function ProductUrlsPage() {
  const supabase = await createSupabaseServerClient()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name')

  return (
    <PageContainer>
      <PageHeader
        title="Product URLs"
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: "URLs" },
        ]}
      />
      <ProductUrlManager products={products || []} />
    </PageContainer>
  )
}

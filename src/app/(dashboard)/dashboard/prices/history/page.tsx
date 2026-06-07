import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductHistoryView } from "@/components/prices/product-history-view"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Price History" }

export default async function PriceHistoryPage() {
  const supabase = await createSupabaseServerClient()

  const { data: products } = await supabase
    .from("products")
    .select(`*, prices (*)`)
    .order("name")

  return (
    <PageContainer>
      <PageHeader
        title="Price History"
        breadcrumbs={[
          { label: "Prices", href: "/dashboard/prices" },
          { label: "History" },
        ]}
      />
      <ProductHistoryView products={products || []} />
    </PageContainer>
  )
}

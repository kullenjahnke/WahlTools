import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PriceAnalytics } from "@/components/prices/price-analytics"
import { PriceHistoryView } from "@/components/prices/price-history-view"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Price History" }

export default async function PriceHistoryPage() {
  const supabase = await createSupabaseServerClient()

  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      prices (*)
    `)
    .order('name')

  // Fetch price change logs
  const { data: priceLogs } = await supabase
    .from('price_change_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(50)

  return (
    <PageContainer>
      <PageHeader
        title="Price History"
        breadcrumbs={[
          { label: "Prices", href: "/dashboard/prices" },
          { label: "History" },
        ]}
      />
      <div className="grid gap-6">
        <PriceAnalytics products={products || []} />
        <PriceHistoryView
          products={products || []}
          priceLogs={priceLogs || []}
        />
      </div>
    </PageContainer>
  )
}

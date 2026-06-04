import { createSupabaseServerClient } from "@/lib/supabase/server"
    
import { PriceAnalytics } from "@/components/prices/price-analytics"
import { PriceHistoryView } from "@/components/prices/price-history-view"

export const metadata = { title: "Price History" }

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
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Price History</h1>
      
      <div className="grid gap-6">
        <PriceAnalytics products={products || []} />
        <PriceHistoryView 
          products={products || []} 
          priceLogs={priceLogs || []} 
        />
      </div>
    </div>
  )
}
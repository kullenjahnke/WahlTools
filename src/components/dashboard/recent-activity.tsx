import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { RecentUpdatesList, type Update } from "./recent-updates-list"

interface PriceRecord {
  id: string
  price: number
  retailer: string
  updated_at: string
  products: {
    name: string
  }[]
}

async function getRecentUpdates(): Promise<Update[]> {
  const supabase = await createSupabaseServerClient()

  // Get recently updated products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(12)

  // Get recent price updates
  const { data: prices } = await supabase
    .from('prices')
    .select(`
      id,
      price,
      retailer,
      updated_at,
      products!inner (name)
    `)
    .order('updated_at', { ascending: false })
    .limit(12)

  const updates: Update[] = []

  if (products) {
    products.forEach(p => {
      updates.push({
        id: p.id,
        type: 'product',
        name: p.name,
        timestamp: p.updated_at
      })
    })
  }

  if (prices) {
    prices.forEach((p: PriceRecord) => {
      updates.push({
        id: p.id,
        type: 'price',
        name: p.products?.[0]?.name || 'Unknown product',
        retailer: p.retailer,
        price: p.price,
        timestamp: p.updated_at
      })
    })
  }

  // Sort by timestamp and return the most recent 20
  return updates
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)
}

export async function RecentActivity() {
  const updates = await getRecentUpdates()

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Recent Updates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent updates</p>
        ) : (
          <RecentUpdatesList updates={updates} />
        )}
      </CardContent>
    </Card>
  )
}

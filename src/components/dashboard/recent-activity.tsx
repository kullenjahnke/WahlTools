import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { formatDistanceToNow } from "date-fns"
import { Package, DollarSign } from "lucide-react"

interface Update {
  id: string
  type: 'product' | 'price'
  name: string
  retailer?: string
  price?: number
  timestamp: string
}

async function getRecentUpdates(): Promise<Update[]> {
  const supabase = await createSupabaseServerClient()

  // Get recently updated products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5)

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
    .limit(5)

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
    prices.forEach(p => {
      updates.push({
        id: p.id,
        type: 'price',
        name: (p.products as any)?.name || 'Unknown product',
        retailer: p.retailer,
        price: p.price,
        timestamp: p.updated_at
      })
    })
  }

  // Sort by timestamp and return top 10
  return updates
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
}

export async function RecentActivity() {
  const updates = await getRecentUpdates()

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent updates</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {updates.map((update) => {
          const timeAgo = update.timestamp
            ? formatDistanceToNow(new Date(update.timestamp), { addSuffix: true })
            : 'Recently'

          return (
            <div key={`${update.type}-${update.id}`} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">
                {update.type === 'product' ? (
                  <Package className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-muted-foreground">
                  {update.type === 'product' ? (
                    <>Product "{update.name}" was updated</>
                  ) : (
                    <>
                      Price updated for "{update.name}"
                      {update.retailer && ` at ${update.retailer}`}
                      {update.price && ` ($${update.price.toFixed(2)})`}
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {timeAgo}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
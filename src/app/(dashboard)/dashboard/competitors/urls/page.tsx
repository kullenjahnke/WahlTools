import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CompetitorProductUrlManager } from "@/components/competitors/competitor-product-url-manager"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export default async function CompetitorProductUrlsPage() {
  const supabase = await createSupabaseServerClient()
  
  // Fetch all competitor products
  const { data: competitorProducts } = await supabase
    .from('competitor_products')
    .select(`
      id, 
      name,
      competitor:competitors(id, name)
    `)
    .order('name')
  
  const formattedProducts = competitorProducts?.map(product => {
    const competitor = Array.isArray(product.competitor) 
      ? product.competitor[0] 
      : product.competitor
      
    return {
      id: product.id,
      name: product.name,
      competitor: competitor?.name || 'Unknown'
    }
  }) || []
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/competitors/products">
              <ChevronLeft className="h-4 w-4" />
              Back to Competitor Products
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-bold">Competitor Product URLs</h1>
          <p className="text-muted-foreground">
            Manage competitor product URLs for each retailer to make price checking easier.
          </p>
        </div>

        <CompetitorProductUrlManager products={formattedProducts} />
      </div>
    </div>
  )
}
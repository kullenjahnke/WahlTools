import { createSupabaseServerClient } from "@/lib/supabase/server"
import { EnhancedProductComparison } from "@/components/comparison/enhanced-product-comparison"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BarChart, TrendingUp, Package } from "lucide-react"

export default async function ComparisonPage() {
  const supabase = await createSupabaseServerClient()
  
  // Fetch all products with brand information
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand_id,
      brand_name,
      brand_type,
      category_id
    `)
    .order('brand_type')
    .order('name')
  
  // Fetch all prices (remove date filter to see all data)
  const { data: prices, error: pricesError } = await supabase
    .from('prices')
    .select(`
      id,
      product_id,
      retailer,
      price,
      original_price,
      on_sale,
      discount_percentage,
      status,
      is_promotion,
      is_sold_out,
      timestamp
    `)
    .order('timestamp', { ascending: false })
  
  // Fetch categories
  const { data: categories, error: categoriesError } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name')
  
  if (productsError || pricesError || categoriesError) {
    console.error('Error fetching data:', { productsError, pricesError, categoriesError })
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium mb-2">Error Loading Comparison Data</h3>
            <p className="text-muted-foreground mb-4">
              Unable to load products and prices for comparison.
            </p>
            <Button asChild>
              <Link href="/dashboard">
                Return to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (!products || products.length === 0) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Products Available</h3>
            <p className="text-muted-foreground mb-4">
              Add products to start comparing prices across retailers.
            </p>
            <Button asChild>
              <Link href="/dashboard/products/new">
                Add Your First Product
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Calculate some quick stats
  const wahlburgersCount = products.filter(p => p.brand_type === 'wahlburgers').length
  const competitorCount = products.filter(p => p.brand_type === 'competitor').length
  const pricesCount = prices?.length || 0
  const retailersWithPrices = new Set(prices?.map(p => p.retailer) || []).size
  
  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Product Price Comparison</h1>
          <p className="text-muted-foreground mt-1">
            Compare prices across all products and retailers
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/analytics">
              <BarChart className="h-4 w-4 mr-2" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/prices/history">
              <TrendingUp className="h-4 w-4 mr-2" />
              Price History
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{wahlburgersCount}</div>
            <div className="text-sm text-muted-foreground">Wahlburgers Products</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{competitorCount}</div>
            <div className="text-sm text-muted-foreground">Competitor Products</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{pricesCount}</div>
            <div className="text-sm text-muted-foreground">Recent Prices</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{retailersWithPrices}</div>
            <div className="text-sm text-muted-foreground">Active Retailers</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Enhanced Comparison Component */}
      <EnhancedProductComparison 
        products={products}
        prices={prices || []}
        categories={categories || []}
      />
    </div>
  )
}
// src/app/(dashboard)/dashboard/comparison/history/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PriceHistoryComparisonChart } from "@/components/comparison/price-history-comparison-chart"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RETAILERS } from "@/lib/config/retailers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PageProps {
  searchParams: Promise<{ retailer?: string; product?: string }>
}

export const metadata = { title: "Comparison History" }

export default async function PriceHistoryComparisonPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedRetailer = params.retailer || RETAILERS[0]
  const selectedProductId = params.product
  const supabase = await createSupabaseServerClient()
  
  // Fetch Wahlburgers products
  const { data: wahlburgersProducts } = await supabase
    .from('products')
    .select(`
      *,
      prices (
        id,
        retailer,
        price,
        timestamp,
        status,
        is_promotion,
        is_sold_out
      )
    `)
    .order('name')
  
  // Default to first product if none selected
  const effectiveProductId = selectedProductId || (wahlburgersProducts && wahlburgersProducts.length > 0 ? wahlburgersProducts[0].id : null)
  
  // Get selected product
  const selectedProduct = wahlburgersProducts?.find(p => p.id === effectiveProductId)
  
  // Get competitor products associated with this Wahlburgers product
  const { data: competitorProducts } = effectiveProductId ? await supabase
    .from('competitor_products')
    .select(`
      *,
      competitor:competitors(id, name),
      competitor_prices (*)
    `)
    .eq('related_product_id', effectiveProductId)
    .order('name') : { data: null }
  
  // Format competitor products
  const formattedCompetitors = competitorProducts?.map(product => {
    // Handle either object or array format for competitor
    const competitor = Array.isArray(product.competitor) 
      ? product.competitor[0] 
      : product.competitor
      
    return {
      ...product,
      competitor_name: competitor?.name || 'Unknown'
    }
  }) || []
  
  // Fetch categories for labels
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
  
  // Create category map for display names
  const categoryMap = new Map(
    categories?.map(cat => [cat.id, cat.name]) || []
  )
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="mb-auto">
            <Link href="/dashboard/comparison">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Comparison
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Price History Comparison</h1>
            <p className="text-muted-foreground">
              Compare price trends between Wahlburgers and competitor products
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <Select 
            defaultValue={selectedRetailer}
            onValueChange={(value) => {
              const url = new URL(window.location.href)
              url.searchParams.set('retailer', value)
              window.location.href = url.toString()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select retailer" />
            </SelectTrigger>
            <SelectContent>
              {RETAILERS.map((retailer) => (
                <SelectItem key={retailer} value={retailer}>
                  {retailer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            defaultValue={effectiveProductId || ''}
            onValueChange={(value) => {
              const url = new URL(window.location.href)
              url.searchParams.set('product', value)
              window.location.href = url.toString()
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {wahlburgersProducts?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} ({categoryMap.get(product.category_id) || 'Uncategorized'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {selectedProduct ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedProduct.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {categoryMap.get(selectedProduct.category_id) || 'Uncategorized'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {formattedCompetitors.length > 0 ? (
                <PriceHistoryComparisonChart
                  wahlburgersProduct={selectedProduct}
                  competitorProducts={formattedCompetitors}
                  selectedRetailer={selectedRetailer}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-4">No competitor products are linked to this Wahlburgers product.</p>
                  <Button asChild>
                    <Link href="/dashboard/competitors/products/new">Add Competitor Product</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-4">No products available for comparison.</p>
          <Button asChild>
            <Link href="/dashboard/products/new">Add Product</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
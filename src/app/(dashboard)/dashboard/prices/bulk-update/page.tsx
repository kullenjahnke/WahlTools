import { createSupabaseServerClient } from "@/lib/supabase/server"
import { BulkPriceEntryForm } from "@/components/prices/bulk-price-entry-form"
import { ProductSelector } from "@/components/prices/product-selector"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { redirect } from "next/navigation"

interface PageProps {
  searchParams: Promise<{ product?: string }>
}

export default async function BulkPriceUpdatePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  // Fetch all products with brand information
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand_name, brand_type')
    .order('name')

  if (error) {
    console.error('Error fetching products:', error)
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/prices">
            <ChevronLeft className="h-4 w-4" />
            Back to Prices
          </Link>
        </Button>
        
        <div className="p-6 bg-red-50 text-red-600 rounded-lg">
          <h2 className="text-lg font-medium mb-2">Error Loading Products</h2>
          <p>{error.message}</p>
        </div>
      </div>
    )
  }

  // Get selected product or default to first
  const selectedProductId = params.product || products?.[0]?.id
  const selectedProduct = products?.find(p => p.id === selectedProductId)

  if (!selectedProduct && products && products.length > 0) {
    // Redirect to first product if selected doesn't exist
    redirect(`/dashboard/prices/bulk-update?product=${products[0].id}`)
  }

  if (!products || products.length === 0) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/prices">
            <ChevronLeft className="h-4 w-4" />
            Back to Prices
          </Link>
        </Button>
        
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              You need to add products before you can record prices.
            </p>
            <Button asChild>
              <Link href="/dashboard/products/new">
                Add Product
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/prices">
            <ChevronLeft className="h-4 w-4" />
            Back to Prices
          </Link>
        </Button>
      </div>

      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-bold">Bulk Price Update</h1>
          <p className="text-muted-foreground">
            Update prices for all retailers at once
          </p>
        </div>

        {/* Product Selector */}
        <Card>
          <CardContent className="p-6">
            <ProductSelector 
              products={products}
              selectedProductId={selectedProductId}
              baseUrl="/dashboard/prices/bulk-update"
            />
          </CardContent>
        </Card>

        {/* Bulk Price Entry Form */}
        {selectedProduct && (
          <BulkPriceEntryForm product={selectedProduct} />
        )}
      </div>
    </div>
  )
}
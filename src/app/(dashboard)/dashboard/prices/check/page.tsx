import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PriceCheckForm } from "@/components/prices/price-check-form"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { RETAILERS } from "@/lib/config/retailers"
import { Card, CardContent } from "@/components/ui/card"
import type { ProductUrl } from "@/types/database"



interface PageProps {
  searchParams: Promise<{ retailer?: string }>
}

export default async function PriceCheckPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  try {
    // Fetch products and categories in parallel
    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from('products')
        .select(`
          *,
          product_urls (*)
        `)
        .order('name'),
      supabase
        .from('product_categories')
        .select('id, name')
    ])

    if (productsResult.error) {
      console.error('Error fetching products:', productsResult.error)
      throw new Error(`Failed to fetch products: ${productsResult.error.message}`)
    }

    if (categoriesResult.error) {
      console.error('Error fetching categories:', categoriesResult.error)
      throw new Error(`Failed to fetch categories: ${categoriesResult.error.message}`)
    }

    // Create a map of category IDs to names
    const categoryMap = new Map(
      categoriesResult.data?.map(cat => [cat.id, cat.name]) || []
    )
    
    // Get unique retailers from product URLs
    const availableRetailers = Array.from(new Set(
      productsResult.data?.flatMap(product => 
        product.product_urls?.map((url: ProductUrl) => url.retailer) || []
      ) || []
    )).filter(Boolean);
    
    // If no available retailers are found, use the default list
    const retailersToShow = availableRetailers.length > 0 ? 
      availableRetailers : 
      RETAILERS;
    
    // Decode the retailer parameter if it exists
    const selectedRetailer = typeof params.retailer === 'string' ? 
      decodeURIComponent(params.retailer) : 
      retailersToShow[0] || RETAILERS[0];
    
    const selectedRetailerExists = retailersToShow.includes(selectedRetailer);
    const effectiveRetailer = selectedRetailerExists ? 
      selectedRetailer : 
      (retailersToShow[0] || RETAILERS[0]);
    
    // Format the products data correctly with proper typing and add category names
    const formattedProducts = productsResult.data?.map(product => {
      // Filter URLs for the selected retailer
      const relevantUrls = product.product_urls
        ? product.product_urls
            .filter((url: ProductUrl) => url.retailer === effectiveRetailer)
            .map((url: ProductUrl) => ({
              retailer: url.retailer,
              url: url.url
            }))
        : [];
        
      return {
        id: product.id,
        name: product.name,
        category: categoryMap.get(product.category_id) || 'Uncategorized',
        urls: relevantUrls
      };
    }) || [];
    
    // Get products with URLs
    const productsWithUrls = formattedProducts.filter(product => 
      product.urls && product.urls.length > 0
    );

    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/prices">
                <ChevronLeft className="h-4 w-4" />
                Back to Prices
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold">Record Price Check</h1>
            <p className="text-muted-foreground">
              Record prices for {effectiveRetailer}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {retailersToShow.map(retailer => (
              <Button
                key={retailer}
                variant={retailer === effectiveRetailer ? "default" : "outline"}
                asChild
                className="whitespace-nowrap"
              >
                <Link href={`/dashboard/prices/check?retailer=${encodeURIComponent(retailer)}`}>
                  {retailer}
                </Link>
              </Button>
            ))}
          </div>

          {productsWithUrls.length > 0 ? (
            <PriceCheckForm 
              products={productsWithUrls}
              retailer={effectiveRetailer}
            />
          ) : (
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
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in PriceCheckPage:', error)
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
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
        </div>
      </div>
    )
  }
}
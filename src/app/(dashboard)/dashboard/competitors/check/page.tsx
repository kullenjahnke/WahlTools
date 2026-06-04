// src/app/(dashboard)/dashboard/competitors/check/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CompetitorPriceCheckForm } from "@/components/competitors/competitor-price-check-form"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { RETAILERS } from "@/lib/config/retailers"
import { Card, CardContent } from "@/components/ui/card"
import type { CompetitorProductUrl } from "@/types/database"

interface PageProps {
  searchParams: Promise<{ retailer?: string; competitor?: string }>
}

export const metadata = { title: "Competitor Prices" }

export default async function CompetitorPriceCheckPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedRetailer = params.retailer || RETAILERS[0]
  const selectedCompetitor = params.competitor
  const supabase = await createSupabaseServerClient()

  try {
    // Fetch brands that are competitors (or all brands if you don't distinguish)
    const { data: competitors, error: competitorError } = await supabase
      .from('brands')
      .select('id, name')
      .order('name')

    if (competitorError) {
      throw new Error(`Failed to fetch competitors: ${competitorError.message}`)
    }

    // Fetch all products that belong to competitor brands
    const query = supabase
      .from('products')
      .select(`
        *,
        brand:brands(id, name),
        product_urls (*)
      `)
      .neq('brand_id', 'wahlburgers') // Assuming you have a way to identify Wahlburgers products
      .order('name')

    // Add competitor filter if specified
    if (selectedCompetitor) {
      query.eq('competitor_id', selectedCompetitor)
    }

    const { data: products, error: productsError } = await query

    if (productsError) {
      throw new Error(`Failed to fetch competitor products: ${productsError.message}`)
    }

    // Get category names
    const { data: categories } = await supabase
      .from('product_categories')
      .select('id, name')

    // Create a map of category IDs to names
    const categoryMap = new Map(
      categories?.map(cat => [cat.id, cat.name]) || []
    )

    // Format products with proper category names and filtered URLs
    const formattedProducts = products?.map(product => {
      // Get the competitor info
      const competitor = Array.isArray(product.competitor) 
        ? product.competitor[0] 
        : product.competitor

      // Filter URLs for the selected retailer
      const relevantUrls = product.competitor_product_urls
        ? product.competitor_product_urls
            .filter((url: CompetitorProductUrl) => url.retailer === selectedRetailer)
            .map((url: CompetitorProductUrl) => ({
              retailer: url.retailer,
              url: url.url
            }))
        : [];
        
      return {
        id: product.id,
        name: product.name,
        competitor: competitor?.name || 'Unknown',
        competitor_id: product.competitor_id,
        category: categoryMap.get(product.category_id) || 'Uncategorized',
        urls: relevantUrls
      };
    }) || [];

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
            <h1 className="text-3xl font-bold">Competitor Price Check</h1>
            <p className="text-muted-foreground">
              Record competitor prices for {selectedRetailer}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {RETAILERS.map(retailer => (
              <Button
                key={retailer}
                variant={retailer === selectedRetailer ? "default" : "outline"}
                asChild
                className="whitespace-nowrap"
              >
                <Link href={`/dashboard/competitors/check?retailer=${encodeURIComponent(retailer)}${selectedCompetitor ? `&competitor=${selectedCompetitor}` : ''}`}>
                  {retailer}
                </Link>
              </Button>
            ))}
          </div>

          {competitors && competitors.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={!selectedCompetitor ? "default" : "outline"}
                asChild
                className="whitespace-nowrap"
              >
                <Link href={`/dashboard/competitors/check?retailer=${encodeURIComponent(selectedRetailer)}`}>
                  All Competitors
                </Link>
              </Button>
              {competitors.map(competitor => (
                <Button
                  key={competitor.id}
                  variant={competitor.id === selectedCompetitor ? "default" : "outline"}
                  asChild
                  className="whitespace-nowrap"
                >
                  <Link href={`/dashboard/competitors/check?retailer=${encodeURIComponent(selectedRetailer)}&competitor=${competitor.id}`}>
                    {competitor.name}
                  </Link>
                </Button>
              ))}
            </div>
          )}

          {formattedProducts.length > 0 ? (
            <CompetitorPriceCheckForm 
              products={formattedProducts}
              retailer={selectedRetailer}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No competitor products found</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedCompetitor 
                    ? "Try selecting a different competitor or retailer." 
                    : "Try adding competitor products or setting up retailer URLs."}
                </p>
                <Button asChild>
                  <Link href="/dashboard/competitors/products/new">
                    Add Competitor Product
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in CompetitorPriceCheckPage:', error)
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/competitors/products">
            <ChevronLeft className="h-4 w-4" />
            Back to Competitor Products
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
// src/app/(dashboard)/dashboard/competitors/products/[id]/view/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Link2 } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { PriceHistoryComparisonChart } from "@/components/comparison/price-history-comparison-chart"
import { RETAILERS } from "@/lib/config/retailers"
import type { Price, CompetitorPrice, CompetitorProductUrl } from "@/types/database"

export default async function CompetitorProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  
  // Fetch the competitor product with all related data
  const { data: product, error } = await supabase
    .from('competitor_products')
    .select(`
      *,
      competitor:competitors(id, name),
      related_product:products(
        id,
        name,
        category_id,
        prices (
          id,
          retailer,
          price,
          timestamp,
          status,
          is_promotion,
          is_sold_out
        )
      ),
      competitor_prices (
        id,
        retailer,
        price,
        timestamp,
        status,
        is_promotion,
        is_sold_out
      ),
      competitor_product_urls (
        id,
        retailer,
        url
      )
    `)
    .eq('id', id)
    .single()
  
  if (error || !product) {
    console.error('Error loading competitor product:', error)
    notFound()
  }
  
  // Format the competitor object
  const competitor = Array.isArray(product.competitor) 
    ? product.competitor[0] 
    : product.competitor
  
  // Fetch categories for labels
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
  
  // Create category map for display names
  const categoryMap = new Map(
    categories?.map(cat => [cat.id, cat.name]) || []
  )
  
  // Get a retailer that has prices for both the competitor and Wahlburgers product
  const retailersWithPrices = RETAILERS.filter(retailer => 
    product.competitor_prices?.some((price: CompetitorPrice) => price.retailer === retailer) &&
    product.related_product?.prices?.some((price: Price) => price.retailer === retailer && price.status === 'active')
  )
  
  const selectedRetailer = retailersWithPrices.length > 0 ? retailersWithPrices[0] : RETAILERS[0]
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/competitors/products">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Competitor Products
          </Link>
        </Button>
      </div>

      <div className="container mx-auto px-6 pt-6">
        <div className="grid gap-6 grid-cols-12">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-4 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold">{product.name}</h1>
                    <p className="text-muted-foreground mt-1">
                      {competitor?.name || 'Unknown Competitor'}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Added {format(new Date(product.created_at), 'MMMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild>
                      <Link href={`/dashboard/competitors/products/${id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Product
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/dashboard/competitors/check?competitor=${product.competitor_id}`}>
                        <Link2 className="h-4 w-4 mr-2" />
                        Manage Prices
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Category</h3>
                    <p>{categoryMap.get(product.category_id) || 'Uncategorized'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Related Wahlburgers Product</h3>
                    {product.related_product ? (
                      <Link 
                        href={`/dashboard/products/${product.related_product.id}/view`}
                        className="text-primary hover:underline"
                      >
                        {product.related_product.name}
                      </Link>
                    ) : (
                      <p className="text-muted-foreground">None</p>
                    )}
                  </div>
                  
                  {product.weight_oz && (
                    <div>
                      <h3 className="font-medium">Weight</h3>
                      <p>{product.weight_oz} oz</p>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-medium">Status</h3>
                    <p>{product.is_active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Retailer URLs</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  {product.competitor_product_urls && product.competitor_product_urls.length > 0 ? (
                    product.competitor_product_urls.map((url: CompetitorProductUrl) => (
                      <div key={url.id} className="flex justify-between items-center">
                        <span>{url.retailer}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          asChild
                        >
                          <a href={url.url} target="_blank" rel="noopener noreferrer">
                            <Link2 className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No retailer URLs configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Price Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {product.related_product ? (
                  <PriceHistoryComparisonChart
                    wahlburgersProduct={product.related_product}
                    competitorProducts={[{
                      ...product,
                      name: product.name
                    }]}
                    selectedRetailer={selectedRetailer}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>This competitor product is not linked to any Wahlburgers product.</p>
                    <Button 
                      className="mt-4" 
                      asChild
                    >
                      <Link href={`/dashboard/competitors/products/${id}`}>
                        Link to Wahlburgers Product
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {RETAILERS.map(retailer => {
                    const competitorPrice = product.competitor_prices?.find((p: CompetitorPrice) => 
                      p.retailer === retailer
                    );
                    
                    const wahlburgersPrice = product.related_product?.prices?.find((p: Price) => 
                      p.retailer === retailer && p.status === 'active'
                    );
                    
                    const hasAnyPrice = competitorPrice || wahlburgersPrice;
                    
                    if (!hasAnyPrice) return null;
                    
                    let priceDiff = 0;
                    let percentDiff = 0;
                    
                    if (competitorPrice && wahlburgersPrice && 
                        !competitorPrice.is_sold_out && !wahlburgersPrice.is_sold_out) {
                      priceDiff = wahlburgersPrice.price - competitorPrice.price;
                      percentDiff = (priceDiff / wahlburgersPrice.price) * 100;
                    }
                    
                    return (
                      <div key={retailer} className="p-4 border rounded-lg">
                        <h3 className="font-medium text-lg mb-3">{retailer}</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-sm text-muted-foreground mb-1">Wahlburgers</h4>
                            <p className="font-medium">
                              {wahlburgersPrice 
                                ? wahlburgersPrice.is_sold_out 
                                  ? 'Sold Out' 
                                  : `$${wahlburgersPrice.price.toFixed(2)}`
                                : 'No data'
                              }
                            </p>
                            {wahlburgersPrice?.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(wahlburgersPrice.timestamp), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-sm text-muted-foreground mb-1">{competitor?.name}</h4>
                            <p className="font-medium">
                              {competitorPrice 
                                ? competitorPrice.is_sold_out 
                                  ? 'Sold Out' 
                                  : `$${competitorPrice.price.toFixed(2)}`
                                : 'No data'
                              }
                            </p>
                            {competitorPrice?.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(competitorPrice.timestamp), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-sm text-muted-foreground mb-1">Difference</h4>
                            {competitorPrice && wahlburgersPrice && 
                             !competitorPrice.is_sold_out && !wahlburgersPrice.is_sold_out ? (
                              <p className={`font-medium ${
                                priceDiff > 0 ? 'text-red-500' : 
                                priceDiff < 0 ? 'text-green-500' : 
                                'text-muted-foreground'
                              }`}>
                                {priceDiff !== 0 ? (
                                  <>
                                    {priceDiff > 0 ? '+' : ''}${Math.abs(priceDiff).toFixed(2)} 
                                    <span className="text-xs ml-1">
                                      ({Math.abs(percentDiff).toFixed(1)}%)
                                    </span>
                                  </>
                                ) : (
                                  'Same price'
                                )}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">Not comparable</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {!product.competitor_prices || product.competitor_prices.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No price data available for this competitor product.</p>
                      <Button 
                        className="mt-4" 
                        asChild
                      >
                        <Link href={`/dashboard/competitors/check?competitor=${product.competitor_id}`}>
                          Record Prices
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
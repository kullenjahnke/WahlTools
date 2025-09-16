import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Edit2, Package2 } from "lucide-react"
import Image from "next/image"
import { format } from "date-fns"
import { BigYIcon } from "@/components/icons/retailers/big-y"
import { GiantEagleIcon } from "@/components/icons/retailers/giant-eagle"
import { GiantFoodStoresIcon } from "@/components/icons/retailers/giant-food-stores"
import { JewelOscoIcon } from "@/components/icons/retailers/jewel-osco"
import { PublixIcon } from "@/components/icons/retailers/publix"
import { SafewayIcon } from "@/components/icons/retailers/safeway"
import { ShawsIcon } from "@/components/icons/retailers/shaws"
import { ShopRiteIcon } from "@/components/icons/retailers/shoprite"
import { StopAndShopIcon } from "@/components/icons/retailers/stop-and-shop"
import { AcmeIcon } from "@/components/icons/retailers/acme"
import { HyVeeIcon } from "@/components/icons/retailers/hyvee"
import { ProductPriceHistory } from "@/components/prices/product-price-history"
import { QuickPriceEntryWrapper } from "@/components/prices/quick-price-entry-wrapper"
import type { Price, ProductImage as DBProductImage, ProductUrl as DBProductUrl } from "@/types/database"

interface ProductImage {
  id: string
  url: string
  main: boolean
  type: 'product' | 'upc'
}

// Using ProductUrl from database types



interface RetailerIconConfig {
  icon: React.ComponentType<{ className?: string; title?: string }>
  className?: string
}

const retailerIcons: Record<string, RetailerIconConfig> = {
  'Acme': { icon: AcmeIcon },
  'Big Y': { 
    icon: BigYIcon,
    className: 'h-12 w-auto'
  },
  'Giant Eagle': { icon: GiantEagleIcon },
  'Giant Food Stores': { 
    icon: GiantFoodStoresIcon,
    className: 'h-12 w-auto'
  },
  'Hyvee': { icon: HyVeeIcon },
  'Jewel-Osco': { icon: JewelOscoIcon },
  'Publix': { icon: PublixIcon },
  'Safeway': { icon: SafewayIcon },
  'Shaws': { icon: ShawsIcon },
  'ShopRite': { icon: ShopRiteIcon },
  'Stop & Shop': { icon: StopAndShopIcon },
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      product_images (*),
      product_urls (
        retailer,
        url
      ),
      prices (
        id,
        retailer,
        price,
        timestamp,
        status
      )
    `)
    .eq('id', id)
    .single()

  // Add detailed debug logging
  if (product) {
    console.log('Product data:', {
      id: product.id,
      name: product.name,
      description: product.description,
      created_at: product.created_at,
      urls: product.product_urls,
      prices: product.prices?.map((price: Price) => ({
        id: price.id,
        retailer: price.retailer,
        price: price.price,
        timestamp: price.timestamp,
        status: price.status
      })),
      images: product.product_images?.map((img: DBProductImage) => ({
        id: img.id,
        url: img.url,
        main: img.main,
        type: img.type
      }))
    })
  }

  if (error || !product) {
    console.error('Error loading product:', error)
    notFound()
  }

  // Add console logging to verify data structure
  console.log('Product URLs:', product.product_urls)
  console.log('Current Prices:', product.prices)

  const mainImage = product.product_images?.find((img: ProductImage) => img.main)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/products">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </Button>
      </div>

      <div className="container mx-auto px-6 pt-6">
        <div className="grid gap-6 grid-cols-12">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-4 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="aspect-square relative rounded-lg overflow-hidden mb-4">
                  {mainImage ? (
                    <Image
                      src={mainImage.url}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Package2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold">{product.name}</h1>
                    <p className="text-muted-foreground mt-1">
                      Added {format(new Date(product.created_at), 'MMMM d, yyyy')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild>
                      <Link href={`/dashboard/products/${id}`}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Product
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Retailer Links</h2>
                <div className="grid grid-cols-2 gap-3">
                  {product.product_urls?.map((url: DBProductUrl) => {
                    const iconConfig = retailerIcons[url.retailer]
                    if (!iconConfig) return null
                    
                    const Icon = iconConfig.icon
                    return (
                      <a
                        key={url.retailer}
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center p-4 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <Icon 
                          className={iconConfig.className || 'h-8 w-auto'} 
                          title={url.retailer}
                        />
                      </a>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-8 space-y-6">
            <Card>
              <Tabs defaultValue="details" className="p-6">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div>
                    <h3 className="font-medium">Description</h3>
                    <p className="text-muted-foreground mt-1">
                      {product.description || 'No description available'}
                    </p>
                  </div>
                  
                  {product.aliases && product.aliases.length > 0 && (
                    <div>
                      <h3 className="font-medium">Aliases</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {product.aliases.map((alias: string, index: number) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-primary/10 rounded-md text-sm"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-medium">Internal Notes</h3>
                    <p className="text-muted-foreground mt-1">
                      {product.internal_notes || 'No internal notes'}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="pricing" className="mt-4 space-y-6">
                  <QuickPriceEntryWrapper
                    productId={product.id}
                    productName={product.name}
                    retailerUrls={product.product_urls || []}
                    currentPrices={product.prices || []}
                  />
                  {product.prices && product.prices.length > 0 ? (
                    <ProductPriceHistory 
                      productId={product.id}
                      prices={product.prices} 
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-center text-muted-foreground">
                          <p>No price history available for this product.</p>
                          <p className="mt-2">Start tracking prices by adding price entries.</p>
                          <Button className="mt-4" asChild>
                            <Link href={`/dashboard/prices/check?product=${product.id}`}>
                              Add Price Entry
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 
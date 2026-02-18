import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { RETAILERS } from "@/lib/config/retailers"
import { RETAILER_COLOR_MAP, BRAND_COLORS } from "@/lib/config/colors"
import { Product, Price } from "@/types/database"
import { BarChart3, DollarSign, PieChart, ShoppingBag } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// Import all retailer icon components
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
// Create a map of retailer names to their icon components
const retailerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Acme': AcmeIcon,
  'Big Y': BigYIcon,
  'Giant Eagle': GiantEagleIcon,
  'Giant Food Stores': GiantFoodStoresIcon,
  'Jewel-Osco': JewelOscoIcon,
  'Publix': PublixIcon,
  'Safeway': SafewayIcon,
  'Shaws': ShawsIcon,
  'ShopRite': ShopRiteIcon,
  'Stop & Shop': StopAndShopIcon,
}

interface RetailerStats {
  retailer: string
  totalProducts: number
  downOver10: number
  down5to10: number
  down0to5: number
  up0to5: number
  up5to10: number
  upOver10: number
}

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface RetailerPriceOverviewProps {
  products: ProductWithPrices[]
  priceStats?: RetailerStats[]
}

export function RetailerPriceOverview({ products, priceStats }: RetailerPriceOverviewProps) {
  // If we have no product data, return early with an empty placeholder
  if (!products || products.length === 0) {
    return (
      <div className="w-full p-4 text-center text-muted-foreground">
        No product data available. Add products and price data to see overview stats.
      </div>
    );
  }

  // Use pre-calculated stats from server action, or build basic stats from products
  const stats = priceStats || RETAILERS.map(retailer => {
    // Count distinct products with prices for this retailer
    const productsWithPrices = products.filter(product => {
      const prices = product.prices?.filter(p => p && p.retailer === retailer) || []
      return prices.length > 0
    })

    return {
      retailer,
      totalProducts: productsWithPrices.length,
      downOver10: 0, down5to10: 0, down0to5: 0,
      up0to5: 0, up5to10: 0, upOver10: 0,
    }
  })

  // Calculate average price for each retailer
  const averagePrices = RETAILERS.map(retailer => {
    const prices = products.flatMap(p => 
      p.prices?.filter(price => price && price.retailer === retailer && price.status === 'active') || []
    )
    
    const average = prices.length > 0
      ? prices.reduce((sum, price) => sum + price.price, 0) / prices.length
      : 0
      
    return { retailer, average }
  })

  // Find the latest update for each retailer
  const latestUpdates = RETAILERS.map(retailer => {
    const allPrices = products.flatMap(p => 
      p.prices?.filter(price => price && price.retailer === retailer) || []
    )
    
    if (allPrices.length === 0) return { retailer, lastUpdated: null }
    
    const latest = allPrices.reduce((latest, current) => 
      !latest || (current && current.timestamp && new Date(current.timestamp) > new Date(latest.timestamp)) 
        ? current 
        : latest
    , allPrices[0])
    
    return { retailer, lastUpdated: latest?.timestamp }
  })

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-lg">
      <div className="flex w-max space-x-4 p-4">
        {stats.map((retailerStats, index) => {
          const { retailer, totalProducts, downOver10, down5to10, down0to5, up0to5, up5to10, upOver10 } = retailerStats
          const avgPrice = averagePrices.find(p => p.retailer === retailer)?.average || 0
          const lastUpdate = latestUpdates.find(u => u.retailer === retailer)?.lastUpdated

          // Calculate percentages for the 6-bucket chart
          const total = downOver10 + down5to10 + down0to5 + up0to5 + up5to10 + upOver10
          const buckets = [
            { count: downOver10, pct: total > 0 ? (downOver10 / total) * 100 : 0, color: 'from-green-600 to-green-700', label: '> 10% down' },
            { count: down5to10, pct: total > 0 ? (down5to10 / total) * 100 : 0, color: 'from-green-400 to-green-500', label: '5-10% down' },
            { count: down0to5, pct: total > 0 ? (down0to5 / total) * 100 : 0, color: 'from-green-200 to-green-300', label: '0-5% down' },
            { count: up0to5, pct: total > 0 ? (up0to5 / total) * 100 : 0, color: 'from-gray-300 to-gray-400', label: '0-5% up' },
            { count: up5to10, pct: total > 0 ? (up5to10 / total) * 100 : 0, color: 'from-red-300 to-red-400', label: '5-10% up' },
            { count: upOver10, pct: total > 0 ? (upOver10 / total) * 100 : 0, color: 'from-red-500 to-red-600', label: '> 10% up' },
          ]
          
          // Get the appropriate icon component for this retailer
          const IconComponent = retailerIcons[retailer]
          
          // Animation delay based on index for staggered effect
          const animDelay = index * 0.1;
          
          return (
            <Card 
              key={retailer} 
              className="w-[320px] overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
              style={{
                animationDelay: `${animDelay}s`,
                animationFillMode: 'both',
              }}
            >
              <CardHeader className="pb-2 pt-3 border-b flex items-center justify-center">
                <CardTitle className="text-base font-semibold flex items-center justify-center w-full">
                  {/* Show retailer icon instead of text */}
                  {IconComponent ? (
                    <div className="flex justify-center items-center h-10">
                      <IconComponent 
                        className="h-8 w-auto" 
                      />
                    </div>
                  ) : (
                    // Fallback to text if no icon is available
                    <div className="flex items-center">
                      <ShoppingBag 
                        className="h-5 w-5 mr-2" 
                        style={{ color: RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.chart.blue }} 
                      />
                      {retailer}
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Avg. Price</span>
                    </div>
                    <span className="text-2xl font-bold mt-1">
                      ${avgPrice.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground">Products</span>
                      <BarChart3 className="h-4 w-4 ml-1 text-muted-foreground" />
                    </div>
                    <span className="text-2xl font-bold mt-1">
                      {totalProducts}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Price changes</span>
                    <span>Distribution</span>
                  </div>
                  <div
                    className="h-8 w-full flex rounded-lg overflow-hidden shadow-inner bg-gray-100 dark:bg-gray-800"
                    style={{ animation: 'fadeIn 0.5s ease-out forwards', animationDelay: `${animDelay + 0.3}s` }}
                  >
                    {buckets.map((bucket, i) => bucket.pct > 0 && (
                      <div
                        key={i}
                        className={`h-full bg-gradient-to-r ${bucket.color} flex items-center justify-center text-xs text-white transition-all duration-1000 ease-out`}
                        style={{ width: `${bucket.pct}%` }}
                        title={`${bucket.label}: ${bucket.count}`}
                      >
                        {bucket.count > 0 && bucket.pct > 15 && (
                          <span>{bucket.count}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-between text-xs text-muted-foreground mt-3 gap-x-2 gap-y-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-green-500 mr-1"></div>
                      <span>Down: {downOver10 + down5to10 + down0to5}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 mr-1"></div>
                      <span>Flat: {up0to5}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 mr-1"></div>
                      <span>Up: {up5to10 + upOver10}</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-2 text-xs text-muted-foreground flex items-center justify-end border-t">
                  <PieChart className="h-3 w-3 mr-1 opacity-70" />
                  {lastUpdate ? (
                    <span>Updated {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}</span>
                  ) : (
                    <span>No data available</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
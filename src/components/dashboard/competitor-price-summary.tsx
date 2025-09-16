"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Minus, DollarSign, PieChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Product, CompetitorProduct, Price, CompetitorPrice } from "@/types/database"

type ProductWithPrices = Product & { prices?: Price[] }
type CompetitorProductWithPrices = CompetitorProduct & { competitor_prices?: CompetitorPrice[] }

interface PriceComparisonSummaryProps {
  wahlburgersProducts: ProductWithPrices[]
  competitorProducts: CompetitorProductWithPrices[]
  selectedRetailer: string
}

export function CompetitorPriceSummary({ 
  wahlburgersProducts, 
  competitorProducts,
  selectedRetailer
}: PriceComparisonSummaryProps) {
  const router = useRouter()
  
  // Group competitor products by their related Wahlburgers product
  const competitorsByProduct = competitorProducts.reduce((acc, cp) => {
    if (!cp.related_product_id) return acc
    
    if (!acc[cp.related_product_id]) {
      acc[cp.related_product_id] = []
    }
    acc[cp.related_product_id].push(cp)
    return acc
  }, {} as Record<string, CompetitorProductWithPrices[]>)

  // Get latest active price
  const getLatestPrice = (prices: Price[] | CompetitorPrice[] = []) => {
    return prices
      .filter(p => p.retailer === selectedRetailer && p.status === 'active')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  }

  // Calculate price comparison stats
  const stats = {
    totalComparisons: 0,
    higherPriced: 0,
    lowerPriced: 0,
    samePriced: 0,
    averageDifference: 0,
    totalDifference: 0
  }

  wahlburgersProducts.forEach(product => {
    const competitors = competitorsByProduct[product.id] || []
    
    competitors.forEach((competitor: CompetitorProductWithPrices) => {
      const wahlburgersPrice = getLatestPrice(product.prices)
      const competitorPrice = getLatestPrice(competitor.competitor_prices)
      
      if (wahlburgersPrice && competitorPrice && 
          !wahlburgersPrice.is_sold_out && !competitorPrice.is_sold_out) {
        
        stats.totalComparisons++
        const priceDiff = wahlburgersPrice.price - competitorPrice.price
        stats.totalDifference += priceDiff
        
        if (priceDiff > 0) {
          stats.higherPriced++
        } else if (priceDiff < 0) {
          stats.lowerPriced++
        } else {
          stats.samePriced++
        }
      }
    })
  })

  // Calculate average price difference
  if (stats.totalComparisons > 0) {
    stats.averageDifference = stats.totalDifference / stats.totalComparisons
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Price Comparisons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalComparisons}</div>
          <p className="text-xs text-muted-foreground">
            Total product price comparisons
          </p>
          <Button 
            variant="link" 
            size="sm" 
            className="p-0 h-auto mt-2 text-xs"
            onClick={() => router.push('/dashboard/comparison')}
          >
            View comparison details
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average Difference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            stats.averageDifference > 0 ? 'text-red-500' : 
            stats.averageDifference < 0 ? 'text-green-500' : 'text-gray-500'
          }`}>
            {stats.averageDifference !== 0 ? (
              <>
                {stats.averageDifference > 0 ? '+' : ''}
                ${stats.averageDifference.toFixed(2)}
              </>
            ) : (
              <span className="text-gray-500">$0.00</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Average price difference vs competitors
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Price Position</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-2xl font-bold">
            <span className="flex items-center text-green-500">
              <ArrowDown className="inline h-5 w-5 mr-1" />
              {stats.lowerPriced}
            </span>
            <span className="flex items-center text-gray-500">
              <Minus className="inline h-5 w-5 mr-1" />
              {stats.samePriced}
            </span>
            <span className="flex items-center text-red-500">
              <ArrowUp className="inline h-5 w-5 mr-1" />
              {stats.higherPriced}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Lower / Same / Higher priced vs competitors
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/competitors/check')}>
            <DollarSign className="h-4 w-4 mr-2" />
            Update Competitor Prices
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/competitors/products/new')}>
            <PieChart className="h-4 w-4 mr-2" />
            Add Competitor Product
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
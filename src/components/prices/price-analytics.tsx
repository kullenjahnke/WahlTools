"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Product, Price } from "@/types/database"
import { BarChart, ChevronUp, ChevronDown } from "lucide-react"
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceAnalyticsProps {
  products: ProductWithPrices[]
}

export function PriceAnalytics({ products }: PriceAnalyticsProps) {
  const calculateRetailerStats = () => {
    const stats = RETAILERS.map(retailer => {
      // Removed unused retailerPrices variable
      // const retailerPrices = products.flatMap(p => 
      //   p.prices?.filter(price => price.retailer === retailer) || []
      // )

      const latestPrices = products.map(product => {
        const prices = product.prices?.filter(p => p.retailer === retailer) || []
        return prices.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
      }).filter(Boolean)

      const previousPrices = products.map(product => {
        const prices = product.prices?.filter(p => p.retailer === retailer) || []
        return prices.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[1]
      }).filter(Boolean)

      const priceChanges = latestPrices.map((latest, index) => {
        const previous = previousPrices[index]
        if (!previous) return 0
        return ((latest.price - previous.price) / previous.price) * 100
      })

      const averageChange = priceChanges.length > 0
        ? priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length
        : 0

      const totalProducts = latestPrices.length
      const increasedPrices = priceChanges.filter(change => change > 0).length
      const decreasedPrices = priceChanges.filter(change => change < 0).length

      return {
        retailer,
        averageChange,
        totalProducts,
        increasedPrices,
        decreasedPrices,
        color: RETAILER_COLORS[retailer]
      }
    })

    return stats
  }

  const stats = calculateRetailerStats()

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stats.map(({ retailer, averageChange, totalProducts, increasedPrices, decreasedPrices, color }) => (
        <Card key={retailer} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {retailer}
            </CardTitle>
            <BarChart 
              className="h-4 w-4 text-muted-foreground"
              style={{ color: color }}
            />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-baseline">
              <div className="text-2xl font-bold">
                {totalProducts}
              </div>
              <div className={`text-sm font-medium ${
                averageChange > 0 ? 'text-red-500' : averageChange < 0 ? 'text-green-500' : 'text-muted-foreground'
              }`}>
                {averageChange !== 0 && (
                  <>
                    {averageChange > 0 ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />}
                    {Math.abs(averageChange).toFixed(1)}%
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Products tracked
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Increased</span>
                <span className="font-medium text-red-500">{increasedPrices}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Decreased</span>
                <span className="font-medium text-green-500">{decreasedPrices}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Unchanged</span>
                <span className="font-medium">
                  {totalProducts - (increasedPrices + decreasedPrices)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
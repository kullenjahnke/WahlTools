"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react"
import { Product, Price } from "@/types/database"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceSummaryCardsProps {
  products: ProductWithPrices[]
}

export function PriceSummaryCards({ products }: PriceSummaryCardsProps) {
  const retailers = ['Meijer', 'Walmart', 'Jewel-Osco']
  
  const calculateRetailerStats = (retailer: string) => {
    const retailerPrices = products
      .flatMap(p => p.prices || [])
      .filter(p => p.retailer === retailer)
    
    const totalProducts = retailerPrices.length
    const averagePrice = retailerPrices.length > 0
      ? retailerPrices.reduce((sum, p) => sum + p.price, 0) / totalProducts
      : 0
      
    // Calculate price changes in last 30 days
    const now = new Date()
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30))
    
    const recentChanges = retailerPrices.filter(p => 
      new Date(p.timestamp) >= thirtyDaysAgo
    )
    
    const increases = recentChanges.filter(p => p.price > 0).length
    const decreases = recentChanges.filter(p => p.price < 0).length
    
    return {
      totalProducts,
      averagePrice,
      increases,
      decreases
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {retailers.map(retailer => {
        const stats = calculateRetailerStats(retailer)
        
        return (
          <Card key={retailer}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {retailer}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.averagePrice.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalProducts} products tracked
              </p>
              <div className="mt-4 flex gap-4">
                <div className="flex items-center gap-1 text-green-500">
                  <ArrowUpIcon className="h-4 w-4" />
                  <span className="text-sm">{stats.increases}</span>
                </div>
                <div className="flex items-center gap-1 text-red-500">
                  <ArrowDownIcon className="h-4 w-4" />
                  <span className="text-sm">{stats.decreases}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
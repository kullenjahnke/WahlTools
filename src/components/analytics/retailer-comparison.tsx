"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Label
} from 'recharts'
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { Product, Price } from "@/types/database"
import { subDays } from "date-fns"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface RetailerComparisonProps {
  products: ProductWithPrices[]
}

export function RetailerComparison({ products }: RetailerComparisonProps) {
  const getRetailerStats = () => {
    const thirtyDaysAgo = subDays(new Date(), 30)

    return RETAILERS.map(retailer => {
      // Get all prices for this retailer
      const retailerPrices = products.flatMap(product => 
        product.prices?.filter(price => 
          price.retailer === retailer &&
          new Date(price.timestamp) >= thirtyDaysAgo
        ) || []
      )

      // Calculate average price
      const averagePrice = retailerPrices.length > 0
        ? retailerPrices.reduce((sum, price) => sum + price.price, 0) / retailerPrices.length
        : 0

      // Calculate price changes
      const changes = retailerPrices.reduce((acc, price) => {
        const productPrices = products
          .find(p => p.prices?.some(pp => pp.id === price.id))
          ?.prices?.filter(p => p.retailer === retailer)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          || []

        if (productPrices.length > 1) {
          const change = ((productPrices[0].price - productPrices[1].price) / productPrices[1].price) * 100
          if (change > 0) acc.increases++
          else if (change < 0) acc.decreases++
        }
        return acc
      }, { increases: 0, decreases: 0 })

      return {
        retailer,
        averagePrice,
        priceChanges: changes.increases + changes.decreases,
        increases: changes.increases,
        decreases: changes.decreases,
        color: RETAILER_COLORS[retailer]
      }
    })
  }

  const data = getRetailerStats()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retailer Price Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="retailer" 
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis yAxisId="left" orientation="left" stroke="#82ca9d">
                <Label
                  value="Average Price ($)"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: 'middle' }}
                />
              </YAxis>
              <YAxis yAxisId="right" orientation="right" stroke="#8884d8">
                <Label
                  value="Price Changes (30 days)"
                  angle={90}
                  position="insideRight"
                  style={{ textAnchor: 'middle' }}
                />
              </YAxis>
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'averagePrice' 
                    ? `$${value.toFixed(2)}` 
                    : value,
                  name === 'averagePrice' 
                    ? 'Average Price' 
                    : 'Price Changes'
                ]}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="averagePrice"
                fill="#82ca9d"
                name="Average Price"
              />
              <Bar
                yAxisId="right"
                dataKey="priceChanges"
                fill="#8884d8"
                name="Price Changes"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { Product, Price } from "@/types/database"
import { subMonths, startOfMonth } from "date-fns"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface CategoryAnalysisProps {
  products: ProductWithPrices[]
}

export function CategoryAnalysis({ products }: CategoryAnalysisProps) {
  const [timeRange, setTimeRange] = useState("6") // months
  
  const categories = Array.from(new Set(products.map(p => p.category_id)))

  const getCategoryData = () => {
    const startDate = startOfMonth(subMonths(new Date(), parseInt(timeRange)))

    return categories.map(category => {
      const categoryProducts = products.filter(p => p.category_id === category)
      const categoryPrices = categoryProducts.flatMap(product => 
        product.prices?.filter(price => new Date(price.timestamp) >= startDate) || []
      )

      // Calculate average price per retailer
      const retailerAverages = RETAILERS.reduce((acc, retailer) => {
        const retailerPrices = categoryPrices.filter(p => p.retailer === retailer)
        acc[retailer] = retailerPrices.length > 0
          ? retailerPrices.reduce((sum, p) => sum + p.price, 0) / retailerPrices.length
          : 0
        return acc
      }, {} as Record<string, number>)

      // Calculate price volatility (standard deviation of price changes)
      const priceChanges = categoryPrices.reduce((acc, price) => {
        const productPrices = categoryProducts
          .find(p => p.prices?.some(pp => pp.id === price.id))
          ?.prices?.filter(p => p.retailer === price.retailer)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          || []

        if (productPrices.length > 1) {
          const change = ((productPrices[0].price - productPrices[1].price) / productPrices[1].price) * 100
          acc.push(Math.abs(change))
        }
        return acc
      }, [] as number[])

      const volatility = priceChanges.length > 0
        ? Math.sqrt(priceChanges.reduce((sum, change) => sum + Math.pow(change, 2), 0) / priceChanges.length)
        : 0

      return {
        category,
        productCount: categoryProducts.length,
        volatility,
        ...retailerAverages
      }
    })
  }

  const data = getCategoryData()

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Category Analysis</CardTitle>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Months</SelectItem>
              <SelectItem value="6">6 Months</SelectItem>
              <SelectItem value="12">12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                yAxisId="left"
                orientation="left"
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'volatility'
                    ? `${value.toFixed(1)}%`
                    : `$${value.toFixed(2)}`,
                  name === 'volatility'
                    ? 'Price Volatility'
                    : name
                ]}
              />
              <Legend />
              {RETAILERS.map(retailer => (
                <Bar
                  key={retailer}
                  yAxisId="left"
                  dataKey={retailer}
                  fill={RETAILER_COLORS[retailer]}
                  name={retailer}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="volatility"
                stroke="#ff7300"
                name="Price Volatility"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
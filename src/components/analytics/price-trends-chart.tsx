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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { Product, Price } from "@/types/database"
import { startOfMonth, format, subMonths } from "date-fns"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceTrendsChartProps {
  products: ProductWithPrices[]
}

export function PriceTrendsChart({ products }: PriceTrendsChartProps) {
  const [timeRange, setTimeRange] = useState("6")  // months

  const getChartData = () => {
    const startDate = startOfMonth(subMonths(new Date(), parseInt(timeRange)))
    
    // Remove category filtering
    const filteredProducts = products

    // Group prices by month and retailer
    const pricesByMonth = filteredProducts.flatMap(product =>
      product.prices?.filter(price => new Date(price.timestamp) >= startDate) || []
    ).reduce((acc, price) => {
      const month = format(new Date(price.timestamp), 'yyyy-MM')
      if (!acc[month]) {
        acc[month] = {}
      }
      if (!acc[month][price.retailer]) {
        acc[month][price.retailer] = []
      }
      acc[month][price.retailer].push(price.price)
      return acc
    }, {} as Record<string, Record<string, number[]>>)

    // Calculate average prices for each month and retailer
    return Object.entries(pricesByMonth)
      .map(([month, retailers]) => ({
        month,
        ...Object.entries(retailers).reduce((acc, [retailer, prices]) => ({
          ...acc,
          [retailer]: prices.reduce((sum, price) => sum + price, 0) / prices.length
        }), {})
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  const chartData = getChartData()

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Price Trends</CardTitle>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
                <SelectItem value="24">24 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickFormatter={(month) => format(new Date(month + '-01'), 'MMM yyyy')}
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip 
                labelFormatter={(month) => format(new Date(month + '-01'), 'MMMM yyyy')}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
              />
              <Legend />
              {RETAILERS.map(retailer => (
                <Line
                  key={retailer}
                  type="monotone"
                  dataKey={retailer}
                  stroke={RETAILER_COLORS[retailer]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
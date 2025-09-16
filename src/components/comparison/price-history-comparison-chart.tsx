// src/components/comparison/price-history-comparison-chart.tsx
"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
} from 'recharts'
import { format, subDays } from "date-fns"
import type { Product, CompetitorProduct, Price, CompetitorPrice } from "@/types/database"


interface PriceHistoryComparisonChartProps {
  wahlburgersProduct: Product & { prices?: Price[] }
  competitorProducts: (CompetitorProduct & { competitor_prices?: CompetitorPrice[] })[]
  selectedRetailer: string
}

export function PriceHistoryComparisonChart({ 
  wahlburgersProduct, 
  competitorProducts,
  selectedRetailer
}: PriceHistoryComparisonChartProps) {
  const [timeRange, setTimeRange] = useState<string>("90")

  // Format the price history data for the chart
  const formatChartData = () => {
    const cutoffDate = subDays(new Date(), parseInt(timeRange))
    
    // Initialize data structure with Wahlburgers prices
    const pricesByDate: Record<string, Record<string, number>> = {}
    
    // Add Wahlburgers price data points
    if (wahlburgersProduct?.prices) {
      wahlburgersProduct.prices
        .filter((price: Price) => 
          price.retailer === selectedRetailer && 
          new Date(price.timestamp) >= cutoffDate && 
          price.status === 'active' &&
          !price.is_sold_out
        )
        .forEach((price: Price) => {
          const date = format(new Date(price.timestamp), 'yyyy-MM-dd')
          if (!pricesByDate[date]) pricesByDate[date] = {}
          pricesByDate[date]['Wahlburgers'] = price.price
        })
    }
    
    // Add competitor price data points
    competitorProducts.forEach((competitor) => {
      const competitorName = competitor.name
      
      if (competitor.competitor_prices) {
        competitor.competitor_prices
          .filter((price: CompetitorPrice) => 
            price.retailer === selectedRetailer && 
            new Date(price.timestamp) >= cutoffDate && 
            price.status === 'active' &&
            !price.is_sold_out
          )
          .forEach((price: CompetitorPrice) => {
            const date = format(new Date(price.timestamp), 'yyyy-MM-dd')
            if (!pricesByDate[date]) pricesByDate[date] = {}
            pricesByDate[date][competitorName] = price.price
          })
      }
    })
    
    // Convert to array format for Recharts
    const chartData = Object.keys(pricesByDate)
      .sort()
      .map(date => ({
        date,
        ...pricesByDate[date]
      }))
    
    return chartData
  }
  
  const chartData = formatChartData()
  
  // Generate random colors for competitors
  const getCompetitorColor = (index: number) => {
    const colors = [
      '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', 
      '#0891b2', '#4f46e5', '#be123c', '#854d0e', '#15803d'
    ]
    return colors[index % colors.length]
  }
  
  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }> | undefined; label?: string }) => {
    if (active && payload && payload.length && label) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 text-sm font-medium mb-2">
            {format(new Date(label), 'MMMM d, yyyy')}
          </p>
          {payload.map((entry: { color: string; name: string; value: number }, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <p className="text-sm">
                <span className="font-medium">{entry.name}:</span>{' '}
                <span className="font-bold">${entry.value.toFixed(2)}</span>
              </p>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Price History Comparison</CardTitle>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="180">6 months</SelectItem>
            <SelectItem value="365">1 year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(new Date(date), 'MMM d')}
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(2)}`}
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Wahlburgers line */}
              <Line
                type="monotone"
                dataKey="Wahlburgers"
                name="Wahlburgers"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              
              {/* Competitor lines */}
              {competitorProducts.map((competitor, index) => (
                <Line
                  key={competitor.id}
                  type="monotone"
                  dataKey={competitor.name}
                  name={competitor.name}
                  stroke={getCompetitorColor(index)}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1, fill: 'white' }}
                  activeDot={{ r: 5, strokeWidth: 1 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
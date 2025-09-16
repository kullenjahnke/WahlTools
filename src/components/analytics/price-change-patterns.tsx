"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis
} from 'recharts'
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { getDay, parseISO } from "date-fns"
import type { Product, Price } from "@/types/database"

interface PriceChangePoint {
  dayOfWeek: number
  magnitude: number
  count: number
}

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceChangePatternsProps {
  products: ProductWithPrices[]
}

export function PriceChangePatterns({ products }: PriceChangePatternsProps) {
  const getPatternData = () => {
    return RETAILERS.map(retailer => {
      const changes: PriceChangePoint[] = []
      
      products.forEach(product => {
        const prices = product.prices
          ?.filter(p => p.retailer === retailer)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          || []

        for (let i = 1; i < prices.length; i++) {
          const prevPrice = prices[i - 1]
          const currentPrice = prices[i]
          const priceChange = ((currentPrice.price - prevPrice.price) / prevPrice.price) * 100
          const dayOfWeek = getDay(parseISO(currentPrice.timestamp))

          const existingPoint = changes.find(p => 
            p.dayOfWeek === dayOfWeek && 
            Math.abs(p.magnitude - Math.abs(priceChange)) < 0.1
          )

          if (existingPoint) {
            existingPoint.count++
          } else {
            changes.push({
              dayOfWeek,
              magnitude: Math.abs(priceChange),
              count: 1
            })
          }
        }
      })

      return {
        retailer,
        color: RETAILER_COLORS[retailer],
        data: changes
      }
    })
  }

  const patternData = getPatternData()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Change Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid />
              <XAxis 
                dataKey="dayOfWeek" 
                type="number" 
                domain={[0, 6]}
                tickFormatter={(value) => days[value]}
                name="Day"
              />
              <YAxis 
                dataKey="magnitude"
                name="Change (%)"
                unit="%"
              />
              <ZAxis 
                dataKey="count" 
                range={[50, 400]} 
                name="Frequency"
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number | string, name: string) => {
                  switch (name) {
                    case 'Change (%)':
                      return [`${typeof value === 'number' ? value.toFixed(1) : value}%`, 'Price Change']
                    case 'Frequency':
                      return [value, 'Number of Changes']
                    default:
                      return [days[typeof value === 'number' ? value : 0], 'Day']
                  }
                }}
              />
              <Legend />
              {patternData.map(({ retailer, color, data }) => (
                <Scatter
                  key={retailer}
                  name={retailer}
                  data={data}
                  fill={color}
                >
                </Scatter>
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Bubble size indicates frequency of price changes. 
            X-axis shows day of week, Y-axis shows magnitude of price changes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
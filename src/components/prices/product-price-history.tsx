// src/components/prices/product-price-history.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subDays } from "date-fns"
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"


interface ProductPriceHistoryProps {
    productId: string;
    prices: {
      id: string;
      retailer: string;
      price: number;
      timestamp: string;
      status: string;
    }[];
  }

export function ProductPriceHistory({ productId, prices }: ProductPriceHistoryProps) {
  const chart = useChartTheme()
  const router = useRouter()
  const supabase = createClientClient()
  const [timeRange, setTimeRange] = useState("30") // days
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Subscribe to real-time price updates
    const channel = supabase
      .channel('prices')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'prices',
          filter: `product_id=eq.${productId}`
        },
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [productId, router, supabase])

  const refreshData = async () => {
    setIsLoading(true)
    try {
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  // Process the data for the chart
  const getChartData = () => {
    const cutoffDate = subDays(new Date(), parseInt(timeRange))
    
    // Filter prices within the selected time range
    const filteredPrices = prices.filter(price => 
      new Date(price.timestamp) >= cutoffDate
    )

    // Group prices by date and retailer
    const pricesByDate = filteredPrices.reduce((acc, price) => {
      const date = format(new Date(price.timestamp), 'yyyy-MM-dd')
      if (!acc[date]) {
        acc[date] = {}
      }
      acc[date][price.retailer] = price.price
      return acc
    }, {} as Record<string, Record<string, number>>)

    // Convert to chart data format
    return Object.entries(pricesByDate)
      .map(([date, retailers]) => ({
        date,
        ...retailers
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  // Get current prices for each retailer
  const getCurrentPrices = () => {
    return RETAILERS.map(retailer => {
      const retailerPrices = prices.filter(p => p.retailer === retailer)
      const latestPrice = retailerPrices.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]

      return {
        retailer,
        price: latestPrice?.price,
        lastUpdated: latestPrice?.timestamp
      }
    })
  }

  const chartData = getChartData()
  const currentPrices = getCurrentPrices()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Price History</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Price History Chart */}
      <Card>
        <CardContent>
          <div className="h-[400px] w-full relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  stroke={chart.axis}
                  tick={{ fill: chart.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                  stroke={chart.axis}
                  tick={{ fill: chart.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: chart.grid }}
                />
                <Tooltip
                  labelFormatter={(date) => format(new Date(date), 'MMMM d, yyyy')}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.grid}`, borderRadius: 6, color: chart.tooltipText, fontSize: 12 }}
                  labelStyle={{ color: chart.axis }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                {RETAILERS.map((retailer, index) => (
                  <Line
                    key={retailer}
                    type="monotone"
                    dataKey={retailer}
                    stroke={RETAILER_COLORS[retailer] ?? chart.series[index % chart.series.length]}
                    name={retailer}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Current Prices */}
      <Card>
        <CardHeader>
          <CardTitle>Current Prices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentPrices.map(({ retailer, price, lastUpdated }) => (
              <div
                key={retailer}
                className={`p-4 rounded-lg border bg-card ${
                  isLoading ? "opacity-50" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium">{retailer}</span>
                  {price ? (
                    <span className="text-2xl font-bold">${price.toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground">No data</span>
                  )}
                </div>
                {lastUpdated && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Updated {format(new Date(lastUpdated), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
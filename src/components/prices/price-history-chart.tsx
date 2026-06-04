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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, subDays } from 'date-fns'
import { Product, Price } from "@/types/database"
import { RETAILERS } from "@/lib/config/retailers"
import { CHART_CONFIG } from "@/lib/config/colors"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { Calendar } from "lucide-react"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceHistoryChartProps {
  products: ProductWithPrices[]
}

interface ChartDataEntry {
  date: string;
  [retailer: string]: string | number | undefined;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }> | undefined; label?: string }) => {
  if (active && payload && payload.length && label) {
    return (
      <div className="bg-popover text-popover-foreground p-3 rounded-md shadow-md border border-border">
        <p className="text-muted-foreground text-xs font-medium mb-2">
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
    );
  }
  return null;
};

export function PriceHistoryChart({ products }: PriceHistoryChartProps) {
  const chart = useChartTheme()
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [timeRange, setTimeRange] = useState<string>("90")

  const selectedProductData = products.find(p => p.id === selectedProduct)

  const formatChartData = () => {
    if (!selectedProductData?.prices) return []

    const daysAgo = parseInt(timeRange)
    const cutoffDate = subDays(new Date(), daysAgo)
    
    const pricesByDate = selectedProductData.prices
      .filter(price => new Date(price.timestamp) >= cutoffDate)
      .reduce((acc, price) => {
        const date = format(new Date(price.timestamp), 'yyyy-MM-dd')
        if (!acc[date]) acc[date] = {}
        acc[date][price.retailer] = price.price
        return acc
      }, {} as Record<string, Record<string, number>>)

    const entries = Object.entries(pricesByDate)
      .map(([date, prices]) => ({
        date,
        ...prices
      })) as ChartDataEntry[]
    
    return entries.sort((a: ChartDataEntry, b: ChartDataEntry) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }

  const getAveragePrice = () => {
    if (!chartData.length) return 0
    
    const allPrices: number[] = []
    chartData.forEach((dataPoint: ChartDataEntry) => {
      Object.entries(dataPoint).forEach(([key, value]) => {
        if (key !== 'date' && typeof value === 'number') {
          allPrices.push(value)
        }
      })
    })
    
    return allPrices.length ? allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length : 0
  }

  const chartData = formatChartData()
  const averagePrice = getAveragePrice()

  return (
    <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>Price History</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={timeRange}
                onValueChange={setTimeRange}
              >
                <SelectTrigger className="w-[130px] bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[300px]">
              <Select
                value={selectedProduct}
                onValueChange={setSelectedProduct}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedProduct ? (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chart.grid}
                  vertical={false}
                />
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
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: "20px", fontSize: 12 }}
                  iconType="circle"
                  iconSize={8}
                />

                <ReferenceLine
                  y={averagePrice}
                  stroke={chart.brand}
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg: $${averagePrice.toFixed(2)}`,
                    position: 'insideBottomRight',
                    fill: chart.axis,
                    fontSize: 12
                  }}
                />

                {RETAILERS.map((retailer, index) => {
                  const hasData = chartData.some((entry: ChartDataEntry) => entry[retailer] !== undefined)
                  if (!hasData) return null

                  const color = chart.series[index % chart.series.length]
                  return (
                    <Line
                      key={retailer}
                      type="monotone"
                      dataKey={retailer}
                      name={retailer}
                      stroke={color}
                      strokeWidth={CHART_CONFIG.common.strokeWidth}
                      dot={{ r: 2, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                      animationDuration={CHART_CONFIG.common.animationDuration}
                      animationEasing="ease"
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Select a product to view price history
          </div>
        )}
      </CardContent>
    </Card>
  )
}
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
import { RETAILER_COLOR_MAP, CHART_CONFIG, BRAND_COLORS } from "@/lib/config/colors"
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
    );
  }
  return null;
};

export function PriceHistoryChart({ products }: PriceHistoryChartProps) {
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
                  strokeDasharray={CHART_CONFIG.grid.strokeDasharray} 
                  stroke={CHART_CONFIG.grid.stroke}
                  vertical={CHART_CONFIG.grid.vertical}
                  horizontal={CHART_CONFIG.grid.horizontal}
                />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis 
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: "20px" }}
                  iconType="circle"
                  iconSize={10}
                />
                
                <ReferenceLine 
                  y={averagePrice} 
                  stroke={BRAND_COLORS.info} 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: $${averagePrice.toFixed(2)}`,
                    position: 'insideBottomRight',
                    fill: BRAND_COLORS.info,
                    fontSize: 12
                  }}
                />
                
                {RETAILERS.map((retailer) => {
                  const hasData = chartData.some((entry: ChartDataEntry) => entry[retailer] !== undefined)
                  if (!hasData) return null
                  
                  return (
                    <Line
                      key={retailer}
                      type="monotone"
                      dataKey={retailer}
                      name={retailer}
                      stroke={RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.chart.blue}
                      strokeWidth={CHART_CONFIG.common.strokeWidth}
                      dot={{ 
                        r: CHART_CONFIG.common.dotRadius,
                        fill: RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.chart.blue,
                        strokeWidth: 1,
                        stroke: "white"
                      }}
                      activeDot={{ 
                        r: CHART_CONFIG.common.activeDotRadius,
                        stroke: "white",
                        strokeWidth: 2,
                        fill: RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.chart.blue
                      }}
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
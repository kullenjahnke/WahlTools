"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { RETAILERS } from "@/lib/config/retailers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { Product, Price } from "@/types/database"
import { format, subDays, subMonths } from "date-fns"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ArrowDown,
  ArrowUp,
} from "lucide-react"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface ProductAnalyticsProps {
  products: ProductWithPrices[]
}

const TIME_RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 1 year" },
]

interface RetailerMetric {
  retailer: string
  min: number | null
  max: number | null
  avg: number | null
  count: number
  wowChange: number | null
}

/**
 * Get the Monday 00:00 EST of the week containing the given date.
 */
function getWeekStartEST(date: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || ""

  const dayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  }
  const dayOffset = dayMap[get("weekday")] ?? 0
  const y = parseInt(get("year"))
  const m = parseInt(get("month")) - 1
  const d = parseInt(get("day")) - dayOffset

  return new Date(Date.UTC(y, m, d, 5, 0, 0))
}

export function ProductAnalytics({ products }: ProductAnalyticsProps) {
  const chart = useChartTheme()
  // Stable monochrome-leaning color per retailer so the line, legend swatch,
  // and table swatch all agree.
  const retailerColor = (retailer: string) =>
    chart.series[Math.max(0, RETAILERS.indexOf(retailer as (typeof RETAILERS)[number])) % chart.series.length]
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [timeRange, setTimeRange] = useState("90")
  const [enabledRetailers, setEnabledRetailers] = useState<Set<string>>(
    new Set(RETAILERS as readonly string[])
  )

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const toggleRetailer = (retailer: string) => {
    setEnabledRetailers((prev) => {
      const next = new Set(prev)
      if (next.has(retailer)) {
        next.delete(retailer)
      } else {
        next.add(retailer)
      }
      return next
    })
  }

  // Build chart data: price by date, one key per retailer
  const chartData = useMemo(() => {
    if (!selectedProduct?.prices) return []

    const days = parseInt(timeRange)
    const cutoff = days <= 90 ? subDays(new Date(), days) : subMonths(new Date(), days / 30)

    const filtered = selectedProduct.prices.filter(
      (p) => new Date(p.timestamp) >= cutoff && p.price > 0
    )

    // Group by date
    const byDate: Record<string, Record<string, number[]>> = {}
    for (const p of filtered) {
      const dateKey = format(new Date(p.timestamp), "yyyy-MM-dd")
      if (!byDate[dateKey]) byDate[dateKey] = {}
      if (!byDate[dateKey][p.retailer]) byDate[dateKey][p.retailer] = []
      byDate[dateKey][p.retailer].push(p.price)
    }

    return Object.entries(byDate)
      .map(([date, retailers]) => {
        const entry: Record<string, string | number> = { date }
        for (const [retailer, prices] of Object.entries(retailers)) {
          // Use latest price for each date (prices are already sorted)
          entry[retailer] = prices[prices.length - 1]
        }
        return entry
      })
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
  }, [selectedProduct, timeRange])

  // Calculate per-retailer metrics
  const metrics: RetailerMetric[] = useMemo(() => {
    if (!selectedProduct?.prices) return []

    const days = parseInt(timeRange)
    const cutoff = days <= 90 ? subDays(new Date(), days) : subMonths(new Date(), days / 30)

    const filtered = selectedProduct.prices.filter(
      (p) => new Date(p.timestamp) >= cutoff && p.price > 0
    )

    // WoW calculation
    const now = new Date()
    const currentWeekStart = getWeekStartEST(now)
    const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    return (RETAILERS as readonly string[])
      .filter((r) => enabledRetailers.has(r))
      .map((retailer) => {
        const rPrices = filtered
          .filter((p) => p.retailer === retailer)
          .map((p) => p.price)

        if (rPrices.length === 0) {
          return { retailer, min: null, max: null, avg: null, count: 0, wowChange: null }
        }

        const min = Math.min(...rPrices)
        const max = Math.max(...rPrices)
        const avg = rPrices.reduce((s, v) => s + v, 0) / rPrices.length

        // WoW: latest price in current week vs latest in previous week
        const allPrices = selectedProduct.prices?.filter(
          (p) => p.retailer === retailer && p.price > 0
        ) || []

        let currentWeekPrice: number | null = null
        let prevWeekPrice: number | null = null

        for (const p of allPrices.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )) {
          const ts = new Date(p.timestamp)
          if (ts >= currentWeekStart && currentWeekPrice === null) {
            currentWeekPrice = p.price
          } else if (ts >= prevWeekStart && ts < currentWeekStart && prevWeekPrice === null) {
            prevWeekPrice = p.price
          }
        }

        const wowChange =
          currentWeekPrice !== null && prevWeekPrice !== null && prevWeekPrice > 0
            ? ((currentWeekPrice - prevWeekPrice) / prevWeekPrice) * 100
            : null

        return { retailer, min, max, avg, count: rPrices.length, wowChange }
      })
      .filter((m) => m.count > 0)
  }, [selectedProduct, timeRange, enabledRetailers])

  // Retailers that actually have data for this product
  const retailersWithData = useMemo(() => {
    if (!selectedProduct?.prices) return new Set<string>()
    return new Set(selectedProduct.prices.filter(p => p.price > 0).map((p) => p.retailer))
  }, [selectedProduct])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Product Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium mb-2 block">
                Select Product
              </Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Time Range
              </Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedProductId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Select a product</h3>
            <p className="text-muted-foreground">
              Choose a product above to view its price analytics across
              retailers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Retailer filter */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-3">
                <span className="text-sm font-medium text-muted-foreground mr-1 self-center">
                  Retailers:
                </span>
                {(RETAILERS as readonly string[]).map((retailer) => {
                  const hasData = retailersWithData.has(retailer)
                  return (
                    <div
                      key={retailer}
                      className="flex items-center gap-1.5"
                    >
                      <Checkbox
                        id={`retailer-${retailer}`}
                        checked={enabledRetailers.has(retailer)}
                        onCheckedChange={() => toggleRetailer(retailer)}
                        disabled={!hasData}
                      />
                      <Label
                        htmlFor={`retailer-${retailer}`}
                        className={`text-sm cursor-pointer ${
                          !hasData ? "text-muted-foreground/50" : ""
                        }`}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-1"
                          style={{
                            backgroundColor: retailerColor(retailer),
                          }}
                        />
                        {retailer}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Price Over Time — {selectedProduct?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No price data available for this range.
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => format(new Date(d), "MMM d")}
                        stroke={chart.axis}
                        tick={{ fill: chart.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: chart.grid }}
                      />
                      <YAxis
                        tickFormatter={(v) => `$${v.toFixed(2)}`}
                        stroke={chart.axis}
                        tick={{ fill: chart.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: chart.grid }}
                        width={60}
                      />
                      <Tooltip
                        labelFormatter={(d) =>
                          format(new Date(d as string), "MMM d, yyyy")
                        }
                        formatter={(value: number, name: string) => [
                          `$${value.toFixed(2)}`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: chart.tooltipBg,
                          border: `1px solid ${chart.grid}`,
                          borderRadius: "0.375rem",
                          color: chart.tooltipText,
                          fontSize: 12,
                          padding: "0.5rem 0.75rem",
                        }}
                        labelStyle={{ color: chart.axis }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                      {metrics.length > 0 && (
                        <ReferenceLine
                          y={
                            metrics.reduce((s, m) => s + (m.avg || 0), 0) /
                            metrics.filter((m) => m.avg !== null).length
                          }
                          stroke={chart.brand}
                          strokeDasharray="5 5"
                          label={{
                            value: "Avg",
                            position: "insideTopRight",
                            fill: chart.axis,
                            fontSize: 11,
                          }}
                        />
                      )}
                      {(RETAILERS as readonly string[])
                        .filter(
                          (r) =>
                            enabledRetailers.has(r) &&
                            retailersWithData.has(r)
                        )
                        .map((retailer) => (
                          <Line
                            key={retailer}
                            type="monotone"
                            dataKey={retailer}
                            stroke={retailerColor(retailer)}
                            strokeWidth={2}
                            dot={{ r: 2.5, strokeWidth: 0, fill: retailerColor(retailer) }}
                            activeDot={{ r: 4, strokeWidth: 0, fill: retailerColor(retailer) }}
                            connectNulls
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metrics table */}
          {metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Retailer Metrics — {selectedProduct?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">
                          Retailer
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Min
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Max
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Avg
                        </th>
                        <th className="text-right py-2 px-3 font-medium">
                          Data Points
                        </th>
                        <th className="text-right py-2 pl-3 font-medium">
                          WoW Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m) => (
                        <tr key={m.retailer} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: retailerColor(m.retailer),
                                }}
                              />
                              {m.retailer}
                            </div>
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono">
                            {m.min !== null ? (
                              <span className="text-green-600">
                                <ArrowDown className="h-3 w-3 inline mr-0.5" />
                                ${m.min.toFixed(2)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono">
                            {m.max !== null ? (
                              <span className="text-red-600">
                                <ArrowUp className="h-3 w-3 inline mr-0.5" />
                                ${m.max.toFixed(2)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono">
                            {m.avg !== null
                              ? `$${m.avg.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="text-right py-2.5 px-3">
                            {m.count}
                          </td>
                          <td className="text-right py-2.5 pl-3">
                            {m.wowChange !== null ? (
                              <Badge
                                variant="secondary"
                                className={`font-mono ${
                                  m.wowChange > 0.1
                                    ? "bg-red-100 text-red-700"
                                    : m.wowChange < -0.1
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {m.wowChange > 0.1 ? (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                ) : m.wowChange < -0.1 ? (
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                ) : (
                                  <Minus className="h-3 w-3 mr-1" />
                                )}
                                {m.wowChange > 0 ? "+" : ""}
                                {m.wowChange.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

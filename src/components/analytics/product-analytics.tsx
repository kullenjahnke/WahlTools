"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Chip } from "@/components/ui/chip"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { Product, Price } from "@/types/database"
import { format, subDays, subMonths } from "date-fns"
import { BarChart3, Package, Plus, Store, Tags, TrendingDown, TrendingUp, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ProductWithPrices = Product & { prices?: Price[] }

interface ProductAnalyticsProps {
  products: ProductWithPrices[]
  categories: Array<{ id: string; name: string }>
}

type Mode = "retailer" | "product" | "category"

const MODES: { value: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "retailer", label: "Retailer", icon: Store },
  { value: "product", label: "Product", icon: Package },
  { value: "category", label: "Category", icon: Tags },
]

const TIME_RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 1 year" },
]

// Palette for product/category series (retailers use their brand colors).
const SERIES_PALETTE = [
  "#2563eb", "#7c3aed", "#0891b2", "#db2777", "#f78427",
  "#16a34a", "#e11d48", "#9333ea", "#0d9488", "#64748b",
]

const MAX_PRODUCT_SERIES = 8

interface Series {
  key: string
  label: string
  color: string
  pointsByDate: Map<string, number>
}

interface SeriesMetric {
  key: string
  label: string
  color: string
  min: number | null
  max: number | null
  avg: number | null
  count: number
  wowChange: number | null
}

function getWeekStartEST(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ""
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[get("weekday")] ?? 0
  return new Date(Date.UTC(parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")) - dayOffset, 5, 0, 0))
}

function aggregateByDate(
  prices: { price: number | null; timestamp: string }[],
  cutoffMs: number
): Map<string, number> {
  const buckets = new Map<string, number[]>()
  for (const p of prices) {
    if (p.price == null || p.price <= 0) continue
    const t = new Date(p.timestamp).getTime()
    if (cutoffMs && t < cutoffMs) continue
    const key = format(new Date(p.timestamp), "yyyy-MM-dd")
    const arr = buckets.get(key) ?? []
    arr.push(p.price)
    buckets.set(key, arr)
  }
  const out = new Map<string, number>()
  for (const [k, arr] of buckets) out.set(k, arr.reduce((a, b) => a + b, 0) / arr.length)
  return out
}

function computeMetric(series: Series): SeriesMetric {
  const entries = [...series.pointsByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const values = entries.map(([, v]) => v)
  if (values.length === 0) {
    return { key: series.key, label: series.label, color: series.color, min: null, max: null, avg: null, count: 0, wowChange: null }
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length

  const currentWeekStart = getWeekStartEST(new Date())
  const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  let currentWeek: number | null = null
  let prevWeek: number | null = null
  for (let i = entries.length - 1; i >= 0; i--) {
    const d = new Date(entries[i][0])
    if (d >= currentWeekStart && currentWeek === null) currentWeek = entries[i][1]
    else if (d >= prevWeekStart && d < currentWeekStart && prevWeek === null) prevWeek = entries[i][1]
  }
  const wowChange =
    currentWeek !== null && prevWeek !== null && prevWeek > 0
      ? ((currentWeek - prevWeek) / prevWeek) * 100
      : null

  return { key: series.key, label: series.label, color: series.color, min, max, avg, count: values.length, wowChange }
}

export function ProductAnalytics({ products, categories }: ProductAnalyticsProps) {
  const chart = useChartTheme()
  const [mode, setMode] = useState<Mode>("retailer")
  const [timeRange, setTimeRange] = useState("90")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || "Uncategorized"

  const cutoffMs = useMemo(() => {
    const days = parseInt(timeRange)
    const cutoff = days <= 90 ? subDays(new Date(), days) : subMonths(new Date(), days / 30)
    return cutoff.getTime()
  }, [timeRange])

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  // Build the series for the current mode.
  const series: Series[] = useMemo(() => {
    if (mode === "retailer") {
      if (!selectedProduct?.prices) return []
      const withData = RETAILERS.filter((r) =>
        selectedProduct.prices!.some(
          (p) => p.retailer === r && p.price != null && p.price > 0 && new Date(p.timestamp).getTime() >= cutoffMs
        )
      )
      return withData.map((retailer) => ({
        key: retailer,
        label: retailer,
        color: RETAILER_COLORS[retailer] ?? chart.axis,
        pointsByDate: aggregateByDate(
          selectedProduct.prices!.filter((p) => p.retailer === retailer),
          cutoffMs
        ),
      }))
    }

    if (mode === "product") {
      return selectedProductIds
        .map((id, i) => {
          const product = products.find((p) => p.id === id)
          if (!product) return null
          return {
            key: id,
            label: product.name,
            color: SERIES_PALETTE[i % SERIES_PALETTE.length],
            pointsByDate: aggregateByDate(product.prices ?? [], cutoffMs),
          }
        })
        .filter((s): s is Series => !!s && s.pointsByDate.size > 0)
    }

    // category mode
    const byCategory = new Map<string, { price: number | null; timestamp: string }[]>()
    for (const product of products) {
      const arr = byCategory.get(product.category_id) ?? []
      for (const price of product.prices ?? []) arr.push(price)
      byCategory.set(product.category_id, arr)
    }
    let i = 0
    const out: Series[] = []
    for (const [catId, prices] of byCategory) {
      const pointsByDate = aggregateByDate(prices, cutoffMs)
      if (pointsByDate.size === 0) continue
      out.push({
        key: catId,
        label: categoryName(catId),
        color: SERIES_PALETTE[i % SERIES_PALETTE.length],
        pointsByDate,
      })
      i++
    }
    return out.sort((a, b) => a.label.localeCompare(b.label))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedProduct, selectedProductIds, products, cutoffMs, chart.axis])

  const visibleSeries = series.filter((s) => !hidden.has(s.key))

  const chartData = useMemo(() => {
    const allDates = new Set<string>()
    for (const s of visibleSeries) for (const d of s.pointsByDate.keys()) allDates.add(d)
    return [...allDates]
      .sort()
      .map((date) => {
        const row: Record<string, string | number> = { date }
        for (const s of visibleSeries) {
          const v = s.pointsByDate.get(date)
          if (v != null) row[s.key] = v
        }
        return row
      })
  }, [visibleSeries])

  const metrics = useMemo(() => visibleSeries.map(computeMetric), [visibleSeries])

  const toggleSeries = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const addProduct = (id: string) => {
    if (selectedProductIds.length < MAX_PRODUCT_SERIES && !selectedProductIds.includes(id)) {
      setSelectedProductIds([...selectedProductIds, id])
    }
  }
  const removeProduct = (id: string) =>
    setSelectedProductIds(selectedProductIds.filter((x) => x !== id))

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, ProductWithPrices[]>()
    for (const p of products) {
      if (mode === "product" && selectedProductIds.includes(p.id)) continue
      const brand = p.brand_type === "wahlburgers" ? "Wahlburgers" : p.brand_name || "Other"
      const arr = groups.get(brand) ?? []
      arr.push(p)
      groups.set(brand, arr)
    }
    return Array.from(groups.entries())
  }, [products, mode, selectedProductIds])

  const needsSelection =
    (mode === "retailer" && !selectedProductId) ||
    (mode === "product" && selectedProductIds.length === 0)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Compare by</span>
            <div className="inline-flex rounded-md border border-input p-0.5">
              {MODES.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setMode(m.value); setHidden(new Set()) }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors",
                      mode === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {mode === "retailer" && (
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Product</span>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "product" && (
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Products ({selectedProductIds.length}/{MAX_PRODUCT_SERIES})
              </span>
              <Select value="" onValueChange={addProduct} disabled={selectedProductIds.length >= MAX_PRODUCT_SERIES}>
                <SelectTrigger>
                  <Plus className="size-4 text-muted-foreground" />
                  <SelectValue placeholder={selectedProductIds.length >= MAX_PRODUCT_SERIES ? "Max reached" : "Add a product…"} />
                </SelectTrigger>
                <SelectContent>
                  {groupedProducts.map(([brand, items]) => (
                    <SelectGroup key={brand}>
                      <SelectLabel>{brand}</SelectLabel>
                      {items.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Time range</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {needsSelection ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mb-2 text-lg font-medium">
              {mode === "retailer" ? "Select a product" : "Add products to compare"}
            </h3>
            <p className="text-muted-foreground">
              {mode === "retailer"
                ? "Choose a product to view its price trend across retailers."
                : "Add one or more products to compare their price trends over time."}
            </p>
          </CardContent>
        </Card>
      ) : series.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No price data available for this selection and range.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Legend / toggles (only series that actually have data) */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              {series.map((s) => {
                const isHidden = hidden.has(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSeries(s.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      isHidden
                        ? "border-border text-muted-foreground/60"
                        : "border-transparent bg-muted text-foreground"
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: isHidden ? "currentColor" : s.color, opacity: isHidden ? 0.4 : 1 }}
                    />
                    <span className={cn(isHidden && "line-through")}>{s.label}</span>
                    {mode === "product" && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${s.label}`}
                        onClick={(e) => { e.stopPropagation(); removeProduct(s.key) }}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Price over time</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                  No visible series — toggle one on above.
                </div>
              ) : (
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => format(new Date(d), "MMM d")}
                        stroke={chart.axis}
                        tick={{ fill: chart.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: chart.grid }}
                        minTickGap={32}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(v) => `$${v.toFixed(2)}`}
                        stroke={chart.axis}
                        tick={{ fill: chart.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: chart.grid }}
                        width={64}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        labelFormatter={(d) => format(new Date(d as string), "MMM d, yyyy")}
                        formatter={(value: number, name: string) => {
                          const s = series.find((x) => x.key === name)
                          return [`$${value.toFixed(2)}`, s?.label ?? name]
                        }}
                        contentStyle={{
                          backgroundColor: chart.tooltipBg,
                          border: `1px solid ${chart.grid}`,
                          borderRadius: "0.5rem",
                          color: chart.tooltipText,
                          fontSize: 12,
                          padding: "0.5rem 0.75rem",
                        }}
                        labelStyle={{ color: chart.axis, marginBottom: 4 }}
                        itemSorter={(item) => -(item.value as number)}
                      />
                      {visibleSeries.map((s) => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          name={s.key}
                          stroke={s.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
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
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {mode === "retailer" ? "Retailer metrics" : mode === "product" ? "Product metrics" : "Category metrics"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">
                          {mode === "retailer" ? "Retailer" : mode === "product" ? "Product" : "Category"}
                        </TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead className="text-right">Avg</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                        <TableHead className="text-right">WoW</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.map((m) => (
                        <TableRow key={m.key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                              <span className="truncate font-medium">{m.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{m.min != null ? `$${m.min.toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.max != null ? `$${m.max.toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{m.avg != null ? `$${m.avg.toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{m.count}</TableCell>
                          <TableCell className="text-right">
                            {m.wowChange != null ? (
                              <Chip
                                size="sm"
                                className="tabular-nums"
                                tone={
                                  m.wowChange < -0.1
                                    ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                                    : m.wowChange > 0.1
                                      ? "bg-destructive/12 text-destructive"
                                      : "neutral"
                                }
                                label={
                                  <>
                                    {m.wowChange < -0.1 ? (
                                      <TrendingDown className="size-3" />
                                    ) : m.wowChange > 0.1 ? (
                                      <TrendingUp className="size-3" />
                                    ) : null}
                                    {m.wowChange > 0 ? "+" : ""}
                                    {m.wowChange.toFixed(1)}%
                                  </>
                                }
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

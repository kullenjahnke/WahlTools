"use client"

import { useMemo, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format, subDays, subMonths, subYears } from "date-fns"
import { cn } from "@/lib/utils"
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { Chip } from "@/components/ui/chip"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Product, Price } from "@/types/database"
import { ChevronDown, PackageSearch } from "lucide-react"

type ProductWithPrices = Product & { prices?: Price[] }

type Range = "4w" | "3m" | "1y" | "all"

interface ProductHistoryViewProps {
  products: ProductWithPrices[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rangeStart(range: Range): Date | null {
  const now = new Date()
  if (range === "4w") return subDays(now, 28)
  if (range === "3m") return subMonths(now, 3)
  if (range === "1y") return subYears(now, 1)
  return null
}

function validPrice(p: Price) {
  // Exclude N/A (price <=0 and not sold out) and sold-out entries from stats/chart
  return p.price > 0 && p.status !== "out_of_stock" && !p.is_sold_out
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProductHistoryView({ products }: ProductHistoryViewProps) {
  const [selectedId, setSelectedId] = useState<string>(products[0]?.id ?? "")
  const [range, setRange] = useState<Range>("3m")
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const chart = useChartTheme()

  const product = products.find((p) => p.id === selectedId) ?? products[0]

  // Filtered and sorted prices for the selected product within the range
  const filteredPrices = useMemo(() => {
    if (!product?.prices) return []
    const cutoff = rangeStart(range)
    return product.prices
      .filter((p) => validPrice(p) && (!cutoff || new Date(p.timestamp) >= cutoff))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [product, range])

  // Chart data: group by date, one value per retailer
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    for (const p of filteredPrices) {
      const day = format(new Date(p.timestamp), "yyyy-MM-dd")
      if (!byDate[day]) byDate[day] = {}
      // Keep the latest entry per retailer per day
      byDate[day][p.retailer] = p.price
    }
    return Object.entries(byDate)
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [filteredPrices])

  // Stats: use all (unfiltered by range) valid prices for baseline stats
  const allValidPrices = useMemo(() => {
    if (!product?.prices) return []
    return product.prices
      .filter(validPrice)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [product])

  const stats = useMemo(() => {
    if (!allValidPrices.length) return null

    // Latest price per retailer
    const latestPerRetailer: Record<string, number> = {}
    for (const p of allValidPrices) {
      latestPerRetailer[p.retailer] = p.price
    }
    const latestValues = Object.values(latestPerRetailer)
    const currentAvg = latestValues.length
      ? latestValues.reduce((s, v) => s + v, 0) / latestValues.length
      : null

    const allPriceValues = allValidPrices.map((p) => p.price)
    const lowest = Math.min(...allPriceValues)
    const highest = Math.max(...allPriceValues)

    // 12-week change: latest avg vs avg 12 weeks ago
    const cutoff12w = subDays(new Date(), 84)
    const old12wPrices = allValidPrices
      .filter((p) => new Date(p.timestamp) <= cutoff12w)
      .map((p) => p.price)
    const oldAvg12w = old12wPrices.length
      ? old12wPrices.reduce((s, v) => s + v, 0) / old12wPrices.length
      : null

    const change12w =
      currentAvg !== null && oldAvg12w !== null
        ? ((currentAvg - oldAvg12w) / oldAvg12w) * 100
        : null

    return { currentAvg, lowest, highest, change12w }
  }, [allValidPrices])

  // Change log: consecutive price deltas per retailer for the selected product
  const changeLog = useMemo(() => {
    if (!product?.prices) return []
    const byRetailer: Record<string, Price[]> = {}
    for (const p of product.prices.filter(validPrice)) {
      if (!byRetailer[p.retailer]) byRetailer[p.retailer] = []
      byRetailer[p.retailer].push(p)
    }
    const entries: {
      retailer: string
      oldPrice: number
      newPrice: number
      pct: number
      date: string
    }[] = []
    for (const [retailer, prices] of Object.entries(byRetailer)) {
      const sorted = prices.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        if (prev.price !== curr.price) {
          entries.push({
            retailer,
            oldPrice: prev.price,
            newPrice: curr.price,
            pct: ((curr.price - prev.price) / prev.price) * 100,
            date: curr.timestamp,
          })
        }
      }
    }
    return entries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [product])

  // Filtered products for the picker
  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  )

  function toggleRetailer(retailer: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(retailer)) next.delete(retailer)
      else next.add(retailer)
      return next
    })
  }

  const rangeLabels: { key: Range; label: string }[] = [
    { key: "4w", label: "4W" },
    { key: "3m", label: "3M" },
    { key: "1y", label: "1Y" },
    { key: "all", label: "All" },
  ]

  // Which retailers actually have data in the filtered window
  const activeRetailers = RETAILERS.filter((r) =>
    chartData.some((d) => r in d)
  )

  return (
    <div className="space-y-4">
      {/* Product Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Thumbnail */}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xl overflow-hidden">
            {product?.name ? "🍔" : <PackageSearch className="h-5 w-5 text-muted-foreground" />}
          </span>

          {/* Name + chips */}
          <div className="min-w-0 flex-1">
            {product ? (
              <>
                <p className="truncate text-sm font-semibold text-foreground">
                  {product.name}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {product.brand_name && (
                    <Chip
                      label={product.brand_name}
                      tone={product.brand_type === "wahlburgers" ? "brand" : "auto"}
                      colorKey={product.brand_name}
                      size="sm"
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a product</p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              pickerOpen && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown list */}
        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg">
            <div className="p-2">
              <input
                autoFocus
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No products found
                </p>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id)
                      setPickerOpen(false)
                      setSearch("")
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                      p.id === selectedId && "bg-accent"
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm">
                      🍔
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.brand_name && (
                        <Chip
                          label={p.brand_name}
                          tone={p.brand_type === "wahlburgers" ? "brand" : "auto"}
                          colorKey={p.brand_name}
                          size="sm"
                          className="mt-0.5"
                        />
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      {product && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Current (avg)",
              value:
                stats?.currentAvg != null
                  ? `$${stats.currentAvg.toFixed(2)}`
                  : "—",
              sub: null,
            },
            {
              label: "Lowest",
              value: stats?.lowest != null ? `$${stats.lowest.toFixed(2)}` : "—",
              sub: null,
            },
            {
              label: "Highest",
              value:
                stats?.highest != null ? `$${stats.highest.toFixed(2)}` : "—",
              sub: null,
            },
            {
              label: "12-wk change",
              value:
                stats?.change12w != null
                  ? `${stats.change12w > 0 ? "+" : ""}${stats.change12w.toFixed(1)}%`
                  : "—",
              sub:
                stats?.change12w != null
                  ? stats.change12w < 0
                    ? "↓"
                    : stats.change12w > 0
                    ? "↑"
                    : null
                  : null,
              positive: stats?.change12w != null ? stats.change12w < 0 : false,
            },
          ].map((s) => (
            <Card key={s.label} className="shadow-none">
              <CardContent className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 font-bold tabular-nums text-foreground" style={{ fontSize: "19px" }}>
                  {s.value}
                  {s.sub && (
                    <small
                      className={cn(
                        "ml-1 text-xs font-semibold",
                        "positive" in s && s.positive
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {s.sub}
                    </small>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart card */}
      {product && (
        <Card className="shadow-none">
          <CardContent className="px-4 py-4">
            {/* Top row: label + range chips */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Price by retailer
              </span>
              <div className="flex gap-1.5">
                {rangeLabels.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRange(key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      range === key
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="h-[240px] w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No price data for this range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chart.grid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "MMM d")}
                      stroke={chart.axis}
                      tick={{ fill: chart.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chart.grid }}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      stroke={chart.axis}
                      tick={{ fill: chart.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chart.grid }}
                      width={40}
                    />
                    <Tooltip
                      labelFormatter={(d) => format(new Date(d), "MMMM d, yyyy")}
                      formatter={(value: number, name: string) => [
                        `$${value.toFixed(2)}`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: chart.tooltipBg,
                        border: `1px solid ${chart.grid}`,
                        borderRadius: 8,
                        color: chart.tooltipText,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: chart.axis, fontWeight: 600 }}
                    />
                    {RETAILERS.filter((r) => !hidden.has(r)).map((retailer) => (
                      <Line
                        key={retailer}
                        type="monotone"
                        dataKey={retailer}
                        stroke={RETAILER_COLORS[retailer]}
                        dot={false}
                        strokeWidth={2.5}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeRetailers.map((retailer) => {
                const isHidden = hidden.has(retailer)
                return (
                  <button
                    key={retailer}
                    type="button"
                    onClick={() => toggleRetailer(retailer)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-opacity",
                      isHidden
                        ? "border-border opacity-40 line-through"
                        : "border-border"
                    )}
                  >
                    <span
                      className="inline-block h-0.5 w-2.5 rounded-full"
                      style={{ backgroundColor: RETAILER_COLORS[retailer] }}
                    />
                    {retailer}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change log table */}
      {product && (
        <Card className="shadow-none">
          <CardContent className="px-4 py-4">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Price changes — {product.name}
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Retailer</TableHead>
                  <TableHead>Old</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeLog.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No recorded price changes
                    </TableCell>
                  </TableRow>
                ) : (
                  changeLog.map((entry, i) => {
                    const isDown = entry.pct < 0
                    const isUp = entry.pct > 0
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {entry.retailer}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          ${entry.oldPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          ${entry.newPrice.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tabular-nums font-semibold",
                            isDown &&
                              "text-green-600 dark:text-green-400",
                            isUp &&
                              "text-red-600 dark:text-red-400",
                            !isDown &&
                              !isUp &&
                              "text-muted-foreground"
                          )}
                        >
                          {isDown ? "▼ " : isUp ? "▲ " : ""}
                          {isUp ? "+" : ""}
                          {entry.pct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

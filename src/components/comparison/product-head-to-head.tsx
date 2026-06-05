"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { median } from "@/lib/competitiveness"
import { RETAILERS } from "@/lib/config/retailers"
import { RETAILER_ICONS } from "@/components/icons/retailers"

interface Product {
  id: string
  name: string
  brand_name?: string | null
  brand_type?: string | null
  category_id: string
  product_images?: { url: string; main: boolean }[]
}

interface Price {
  id: string
  product_id: string
  retailer: string
  price: number | null
  original_price?: number | null
  on_sale?: boolean
  is_promotion?: boolean
  discount_percentage?: number | null
  status?: string
  is_sold_out?: boolean
  timestamp: string
}

interface ProductHeadToHeadProps {
  products: Product[]
  prices: Price[]
  categories: Array<{ id: string; name: string }>
}

const MAX_PRODUCTS = 4

const TIMEFRAMES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "all", label: "All time" },
] as const

type Direction = "low" | "high" | "boolTrue"

interface Metrics {
  lowest: number | null
  highest: number | null
  aggregate: number | null // avg or total price across retailers
  retailers: number
  change: number | null
  onPromo: boolean
  competitiveness: number | null // % below category median (positive = cheaper)
  lastUpdated: number | null // whole days ago
}

interface MetricDef {
  key: keyof Metrics
  label: string
  better: Direction
  headline?: boolean
  format: (v: number | boolean | null) => string
}

const money = (v: number | boolean | null) => (typeof v === "number" ? `$${v.toFixed(2)}` : "—")
const integer = (v: number | boolean | null) => (typeof v === "number" ? `${v}` : "—")
const signedPct = (v: number | boolean | null) =>
  typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—"
const yesNo = (v: number | boolean | null) => (v ? "Yes" : "No")
const vsMedian = (v: number | boolean | null) =>
  typeof v === "number" ? (v >= 0 ? `${v.toFixed(0)}% below` : `${Math.abs(v).toFixed(0)}% above`) : "—"
const relativeDays = (v: number | boolean | null) =>
  typeof v === "number" ? (v === 0 ? "Today" : v === 1 ? "Yesterday" : `${v} days ago`) : "—"

function isUsable(p: Price): boolean {
  return (
    p.price != null &&
    p.price > 0 &&
    !p.is_sold_out &&
    (!p.status || p.status === "active" || p.status === "available")
  )
}

function rankValue(m: Metrics, key: keyof Metrics): number | null {
  const v = m[key]
  if (typeof v === "boolean") return v ? 1 : 0
  return v
}

function rankExtents(vals: number[], better: Direction) {
  const distinct = new Set(vals).size
  if (distinct <= 1) return { best: null as number | null, worst: null as number | null }
  if (better === "low") return { best: Math.min(...vals), worst: Math.max(...vals) }
  if (better === "boolTrue") return { best: 1, worst: 0 }
  return { best: Math.max(...vals), worst: Math.min(...vals) }
}

function pillTone(val: number | null, best: number | null, worst: number | null) {
  if (val == null || best == null) return "bg-muted text-foreground"
  if (val === best) return "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
  if (val === worst) return "bg-destructive/12 text-destructive"
  return "bg-muted text-foreground"
}

export function ProductHeadToHead({ products, prices, categories }: ProductHeadToHeadProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [timeframe, setTimeframe] = useState<string>("90")
  const [mode, setMode] = useState<"average" | "total">("average")
  const [sortBy, setSortBy] = useState<keyof Metrics>("lowest")
  const [search, setSearch] = useState("")

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name

  const cutoff = useMemo(() => {
    if (timeframe === "all") return 0
    return Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000
  }, [timeframe])

  // Latest usable price per (product, retailer) within the timeframe.
  const currentPrices = useMemo(() => {
    const map = new Map<string, Map<string, Price>>()
    for (const p of prices) {
      if (!isUsable(p)) continue
      if (cutoff && new Date(p.timestamp).getTime() < cutoff) continue
      let byRetailer = map.get(p.product_id)
      if (!byRetailer) {
        byRetailer = new Map()
        map.set(p.product_id, byRetailer)
      }
      const existing = byRetailer.get(p.retailer)
      if (!existing || new Date(p.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        byRetailer.set(p.retailer, p)
      }
    }
    return map
  }, [prices, cutoff])

  // Category median of all current per-retailer prices (for competitiveness).
  const categoryMedian = useMemo(() => {
    const byCategory = new Map<string, number[]>()
    for (const product of products) {
      const byRetailer = currentPrices.get(product.id)
      if (!byRetailer) continue
      const arr = byCategory.get(product.category_id) ?? []
      for (const price of byRetailer.values()) {
        if (price.price != null) arr.push(price.price)
      }
      byCategory.set(product.category_id, arr)
    }
    const result = new Map<string, number>()
    for (const [cat, arr] of byCategory) {
      if (arr.length > 0) result.set(cat, median(arr))
    }
    return result
  }, [products, currentPrices])

  const metricsFor = useMemo(() => {
    const compute = (product: Product): Metrics => {
      const byRetailer = currentPrices.get(product.id)
      const current = byRetailer ? Array.from(byRetailer.values()) : []
      const values = current.map((p) => p.price as number)

      const lowest = values.length ? Math.min(...values) : null
      const highest = values.length ? Math.max(...values) : null
      const sum = values.reduce((a, b) => a + b, 0)
      const avgPrice = values.length ? sum / values.length : null
      const aggregate = values.length ? (mode === "average" ? sum / values.length : sum) : null

      // Price change %: current avg vs baseline avg (latest price per retailer
      // dated before the timeframe window).
      let change: number | null = null
      if (values.length && byRetailer) {
        const currentAvg = sum / values.length
        const baseline: number[] = []
        for (const retailer of byRetailer.keys()) {
          const prior = prices
            .filter(
              (p) =>
                p.product_id === product.id &&
                p.retailer === retailer &&
                isUsable(p) &&
                (!cutoff || new Date(p.timestamp).getTime() < cutoff)
            )
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
          if (prior?.price != null) baseline.push(prior.price)
        }
        if (baseline.length) {
          const baseAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length
          if (baseAvg > 0) change = ((currentAvg - baseAvg) / baseAvg) * 100
        }
      }

      const onPromo = current.some((p) => p.on_sale || p.is_promotion)

      const med = categoryMedian.get(product.category_id)
      const competitiveness =
        med != null && med > 0 && avgPrice != null ? ((med - avgPrice) / med) * 100 : null

      let lastUpdated: number | null = null
      const allForProduct = prices.filter((p) => p.product_id === product.id)
      if (allForProduct.length) {
        const maxMs = Math.max(...allForProduct.map((p) => new Date(p.timestamp).getTime()))
        lastUpdated = Math.max(0, Math.floor((Date.now() - maxMs) / 86400000))
      }

      return {
        lowest,
        highest,
        aggregate,
        retailers: current.length,
        change,
        onPromo,
        competitiveness,
        lastUpdated,
      }
    }

    const map = new Map<string, Metrics>()
    for (const id of selected) {
      const product = products.find((p) => p.id === id)
      if (product) map.set(id, compute(product))
    }
    return map
  }, [selected, products, currentPrices, categoryMedian, prices, cutoff, mode])

  const metricDefs: MetricDef[] = [
    { key: "lowest", label: "Lowest price", better: "low", headline: true, format: money },
    { key: "retailers", label: "Retailers carrying", better: "high", headline: true, format: integer },
    {
      key: "aggregate",
      label: mode === "average" ? "Avg price" : "Total price",
      better: "low",
      headline: true,
      format: money,
    },
    { key: "highest", label: "Highest price", better: "low", format: money },
    { key: "change", label: "Price change", better: "low", format: signedPct },
    { key: "onPromo", label: "On promotion", better: "boolTrue", format: yesNo },
    { key: "competitiveness", label: "vs. category median", better: "high", format: vsMedian },
    { key: "lastUpdated", label: "Last updated", better: "low", format: relativeDays },
  ]

  // Selected products ordered by the chosen "sort by" metric (best first).
  const orderedSelected = useMemo(() => {
    const def = metricDefs.find((d) => d.key === sortBy)
    const list = selected
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p)
    if (!def) return list
    return [...list].sort((a, b) => {
      const av = rankValue(metricsFor.get(a.id)!, sortBy)
      const bv = rankValue(metricsFor.get(b.id)!, sortBy)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return def.better === "low" ? av - bv : bv - av
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, products, metricsFor, sortBy])

  // Retailers that every selected product is sold in (within the timeframe).
  const commonRetailers = useMemo(() => {
    if (orderedSelected.length < 2) return [] as string[]
    const sets = orderedSelected.map((p) => new Set(currentPrices.get(p.id)?.keys() ?? []))
    return RETAILERS.filter((r) => sets.every((s) => s.has(r)))
  }, [orderedSelected, currentPrices])

  const toggleProduct = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_PRODUCTS
          ? [...prev, id]
          : prev
    )
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand_name?.toLowerCase().includes(q) ?? false)
    )
  }, [products, search])

  const gridTemplateColumns = `minmax(8rem, 11rem) repeat(${orderedSelected.length}, minmax(0, 1fr))`

  const metricCells = (def: MetricDef) => {
    const vals = orderedSelected
      .map((p) => rankValue(metricsFor.get(p.id)!, def.key))
      .filter((v): v is number => v != null)
    const { best, worst } = rankExtents(vals, def.better)
    return orderedSelected.map((p) => {
      const m = metricsFor.get(p.id)!
      const rank = rankValue(m, def.key)
      return { id: p.id, display: def.format(m[def.key]), tone: pillTone(rank, best, worst) }
    })
  }

  const retailerCells = (retailer: string) => {
    const vals = orderedSelected.map((p) => currentPrices.get(p.id)?.get(retailer)?.price ?? null)
    const numeric = vals.filter((v): v is number => v != null)
    const { best, worst } = rankExtents(numeric, "low")
    return orderedSelected.map((p, i) => ({
      id: p.id,
      display: vals[i] != null ? `$${vals[i]!.toFixed(2)}` : "—",
      tone: pillTone(vals[i], best, worst),
    }))
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as keyof Metrics)}>
          <SelectTrigger className="w-[200px]">
            <span className="mr-1 text-sm text-muted-foreground">Sort by</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metricDefs.map((d) => (
              <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Average / Total segmented toggle */}
        <div className="inline-flex rounded-md border border-input p-0.5">
          {(["average", "total"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-3 py-1 text-sm capitalize transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setSelected([])}
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Selection menu */}
        <Card className="shrink-0 lg:w-72">
          <CardContent className="space-y-3 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {selected.length}/{MAX_PRODUCTS} selected
            </div>
            <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {filteredList.map((product) => {
                const isSelected = selected.includes(product.id)
                const atMax = !isSelected && selected.length >= MAX_PRODUCTS
                const mainImage = product.product_images?.find((i) => i.main) || product.product_images?.[0]
                const isWahl = product.brand_type === "wahlburgers"
                const cat = categoryName(product.category_id)
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    disabled={atMax}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                      isSelected
                        ? "border-brand bg-brand-muted/40"
                        : "border-border hover:bg-muted/50",
                      atMax && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {mainImage ? (
                        <Image src={mainImage.url} alt={product.name} fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Package className="size-4 text-muted-foreground/60" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{product.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {cat && <Chip label={cat} size="sm" colorKey={product.category_id} />}
                        <Chip
                          label={isWahl ? product.brand_name || "Wahlburgers" : product.brand_name || "—"}
                          size="sm"
                          tone={isWahl ? "brand" : "auto"}
                          colorKey={product.brand_name || product.id}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
              {filteredList.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No products found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison */}
        <div className="min-w-0 flex-1">
          {orderedSelected.length < 2 ? (
            <Card className="h-full">
              <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-12 text-center">
                <Package className="size-10 text-muted-foreground/60" />
                <p className="font-medium">Add at least two products to compare</p>
                <p className="text-sm text-muted-foreground">
                  Pick up to {MAX_PRODUCTS} products from the list. The best value in each metric is
                  highlighted green, the worst red.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-4 sm:p-6">
                <div className="grid min-w-[520px] items-center gap-x-3 gap-y-3" style={{ gridTemplateColumns }}>
                  {/* Header: entity cards */}
                  <div />
                  {orderedSelected.map((product) => {
                    const mainImage = product.product_images?.find((i) => i.main) || product.product_images?.[0]
                    const isWahl = product.brand_type === "wahlburgers"
                    return (
                      <div key={product.id} className="flex flex-col items-center gap-2 px-1 text-center">
                        <div className="relative size-14 overflow-hidden rounded-xl bg-muted">
                          {mainImage ? (
                            <Image src={mainImage.url} alt={product.name} fill className="object-cover" sizes="56px" />
                          ) : (
                            <div className="flex size-full items-center justify-center">
                              <Package className="size-6 text-muted-foreground/60" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleProduct(product.id)}
                            aria-label={`Remove ${product.name}`}
                            className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</div>
                          <Chip
                            label={isWahl ? product.brand_name || "Wahlburgers" : product.brand_name || "—"}
                            tone={isWahl ? "brand" : "auto"}
                            colorKey={product.brand_name || product.id}
                            size="sm"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )
                  })}

                  {/* Headline metrics */}
                  {metricDefs.filter((d) => d.headline).map((def) => (
                    <Row key={def.key} label={def.label} highlighted={def.key === sortBy} cells={metricCells(def)} />
                  ))}

                  <div className="col-span-full my-1 border-t border-border" />

                  {/* Detail metrics */}
                  {metricDefs.filter((d) => !d.headline).map((def) => (
                    <Row key={def.key} label={def.label} highlighted={def.key === sortBy} cells={metricCells(def)} />
                  ))}

                  {/* Price-by-retailer section */}
                  <div className="col-span-full mt-2 border-t border-border pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Price by retailer
                  </div>
                  {commonRetailers.length === 0 ? (
                    <div className="col-span-full pb-1 text-sm text-muted-foreground">
                      No retailer carries all selected products.
                    </div>
                  ) : (
                    commonRetailers.map((retailer) => {
                      const Icon = RETAILER_ICONS[retailer]
                      return (
                        <Row
                          key={retailer}
                          label={
                            <span className="flex items-center gap-2">
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                {Icon ? <Icon className="h-3.5 w-auto max-w-4" /> : null}
                              </span>
                              <span className="truncate">{retailer}</span>
                            </span>
                          }
                          cells={retailerCells(retailer)}
                        />
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  highlighted,
  cells,
}: {
  label: React.ReactNode
  highlighted?: boolean
  cells: { id: string; display: string; tone: string }[]
}) {
  return (
    <>
      <div
        className={cn(
          "-mx-1 flex items-center rounded-md px-1 py-1 text-sm text-muted-foreground",
          highlighted && "bg-muted/60 font-medium text-foreground"
        )}
      >
        {label}
      </div>
      {cells.map((c) => (
        <div key={c.id} className="flex justify-center">
          <Chip label={c.display} tone={c.tone} size="lg" className="justify-center tabular-nums" />
        </div>
      ))}
    </>
  )
}

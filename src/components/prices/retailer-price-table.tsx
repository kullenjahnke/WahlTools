"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Chip } from "@/components/ui/chip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Product, Price } from "@/types/database"
import { RETAILERS } from "@/lib/config/retailers"
import { daysSince, FRESHNESS_THRESHOLDS } from "@/lib/freshness"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  Search,
  Filter,
  Package,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface RetailerPriceTableProps {
  products: ProductWithPrices[]
  categories?: { id: string; name: string }[]
}

// Cell state model (matches the on-table labels):
//  - active:      a real price updated within the staleness window
//  - stale:       a real price not re-checked in a while ("Last seen")
//  - unavailable: explicitly marked N/A (price 0, not sold out) — no longer sold
type CellState = "active" | "stale" | "unavailable"
type FreshnessFilter = "all" | CellState

const STALE_DAYS = FRESHNESS_THRESHOLDS.staleDays

const FRESHNESS_LABEL: Record<CellState, string> = {
  active: "Active",
  stale: "Stale",
  unavailable: "Unavailable",
}

function isSoldOutPrice(p: Price) {
  return p.status === "out_of_stock" || p.is_sold_out === true
}

function isNAPrice(p: Price) {
  return !isSoldOutPrice(p) && p.price <= 0
}

function isStalePrice(p: Price) {
  return !isNAPrice(p) && (daysSince(p.timestamp) ?? 0) >= STALE_DAYS
}

function priceState(p: Price): CellState {
  if (isNAPrice(p)) return "unavailable"
  return (daysSince(p.timestamp) ?? 0) >= STALE_DAYS ? "stale" : "active"
}

export function RetailerPriceTable({ products, categories = [] }: RetailerPriceTableProps) {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [retailerFilter, setRetailerFilter] = useState<string>("all")
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all")
  const router = useRouter()
  const supabase = createClientClient()

  // Resolve category_id -> name, and list only categories present in the products
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const categoryOptions = Array.from(
    new Set(products.map((p) => p.category_id).filter(Boolean))
  ).map((id) => ({ id, name: categoryMap.get(id) || id }))

  // Get unique retailers that have associations with any product
  const relevantRetailers = Array.from(new Set(
    products.flatMap(product =>
      product.prices?.map(p => p.retailer) || []
    )
  )).filter(Boolean);

  // Use these for the retailer filter and headers
  const availableRetailers = relevantRetailers.length > 0 ? relevantRetailers : RETAILERS;
  const displayedRetailers = retailerFilter === "all" ? availableRetailers : [retailerFilter]

  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel('price-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'prices'
      }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  const getPreviousPrice = (prices: Price[] | undefined, retailer: string, latestPrice: Price) => {
    if (!prices) return null;
    const retailerPrices = prices
      .filter(p => p.retailer === retailer && p.id !== latestPrice.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return retailerPrices[0] || null
  }

  const calculatePriceChange = (latest: Price, previous: Price | null) => {
    if (!previous) return null
    const change = ((latest.price - previous.price) / previous.price) * 100
    return change
  }

  // Restored semantic coloring: a price drop is good (green), a rise is bad (red).
  const getPriceChangeColor = (change: number | null) => {
    if (change === null || change === 0) return "text-muted-foreground"
    return change < 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive"
  }

  const getPriceChangeIcon = (change: number | null) => {
    if (change === null) return null
    if (change > 0) return <ArrowUp className="h-3 w-3 mr-0.5" />
    if (change < 0) return <ArrowDown className="h-3 w-3 mr-0.5" />
    return <Minus className="h-3 w-3 mr-0.5" />
  }

  const getLatestPrice = (prices: Price[] | undefined, retailer: string) => {
    if (!prices) return null;
    const retailerPrices = prices.filter(p => p.retailer === retailer)
    if (retailerPrices.length === 0) return null

    return retailerPrices.reduce((latest, current) => {
      if (!latest) return current
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    }, retailerPrices[0])
  }

  const getLatestUpdate = (product: ProductWithPrices) =>
    product.prices && product.prices.length > 0
      ? product.prices.reduce((latest, current) => {
          if (!latest) return current
          return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
        }, product.prices[0])
      : null

  const filteredProducts = products.filter(product => {
    // Apply text search filter
    const searchMatch = search.trim() === "" ||
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.aliases?.some(alias => alias.toLowerCase().includes(search.toLowerCase())) ?? false)

    // Apply category filter
    const categoryMatch = categoryFilter === "all" || product.category_id === categoryFilter

    // Apply retailer filter
    const retailerMatch = retailerFilter === "all" ||
      product.prices?.some(p => p.retailer === retailerFilter)

    // Apply freshness filter per retailer-cell: when a retailer is selected, use
    // that retailer's latest price; otherwise match if ANY retailer's latest
    // price for this product is in the selected state.
    let freshnessMatch = true
    if (freshnessFilter !== "all") {
      const retailersToCheck = retailerFilter === "all"
        ? Array.from(new Set(product.prices?.map(p => p.retailer) || []))
        : [retailerFilter]
      freshnessMatch = retailersToCheck.some(r => {
        const latest = getLatestPrice(product.prices, r)
        return !!latest && priceState(latest) === freshnessFilter
      })
    }

    return searchMatch && categoryMatch && retailerMatch && freshnessMatch
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:gap-4 md:items-center md:flex-wrap">
            <div className="w-full md:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full md:w-[240px]"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Category Filter */}
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] border-none shadow-none bg-transparent">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Retailer Filter */}
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Select value={retailerFilter} onValueChange={setRetailerFilter}>
                  <SelectTrigger className="w-[140px] border-none shadow-none bg-transparent">
                    <SelectValue placeholder="Retailer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Retailers</SelectItem>
                    {availableRetailers.map((retailer) => (
                      <SelectItem key={retailer} value={retailer}>{retailer}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Freshness Filter */}
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={freshnessFilter}
                  onValueChange={(val) => setFreshnessFilter(val as FreshnessFilter)}
                >
                  <SelectTrigger className="w-[160px] border-none shadow-none bg-transparent">
                    <SelectValue placeholder="Freshness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All freshness</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="stale">Stale</SelectItem>
                    <SelectItem value="unavailable">Unavailable (N/A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-border overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 w-[200px] min-w-[200px] border-r border-border bg-muted">
                Product
              </TableHead>
              <TableHead className="w-[140px] min-w-[140px]">
                Category
              </TableHead>
              {displayedRetailers.map(retailer => (
                <TableHead
                  key={retailer}
                  className="w-[140px] min-w-[140px] text-center"
                >
                  {retailer}
                </TableHead>
              ))}
              <TableHead className="w-[160px] min-w-[160px]">
                Last Updated
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const latestUpdate = getLatestUpdate(product)
              const categoryName = categoryMap.get(product.category_id)

              return (
                <TableRow key={product.id}>
                  <TableCell className="sticky left-0 z-10 bg-background border-r border-border font-medium max-w-[200px]">
                    <div className="truncate">{product.name}</div>
                  </TableCell>
                  <TableCell className="max-w-[140px]">
                    {categoryName ? (
                      <Chip label={categoryName} size="lg" colorKey={product.category_id} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {displayedRetailers.map(retailer => {
                    const latestPrice = getLatestPrice(product.prices, retailer)
                    const hasRetailerAssociation = latestPrice !== null
                    const soldOut = !!latestPrice && isSoldOutPrice(latestPrice)
                    const na = !!latestPrice && isNAPrice(latestPrice)
                    const stale = !!latestPrice && isStalePrice(latestPrice)
                    // Faint tinted backgrounds make old/unavailable data easy to
                    // scan against fresh prices: amber for stale, gray for N/A.
                    const cellTint = na
                      ? "bg-muted/50"
                      : stale
                        ? "bg-amber-500/10 dark:bg-amber-400/10"
                        : ""

                    return (
                      <TableCell
                        key={retailer}
                        className={cn("text-center align-middle", cellTint)}
                      >
                        {hasRetailerAssociation && latestPrice ? (
                          soldOut || na ? (
                            <div className="flex flex-col items-center gap-1">
                              <Chip
                                label={soldOut ? "Sold out" : "N/A"}
                                tone="neutral"
                                size="lg"
                              />
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(latestPrice.timestamp), 'MMM d, yyyy')}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold tabular-nums">${latestPrice.price.toFixed(2)}</span>
                                {latestPrice.is_promotion && (
                                  <Badge variant="brand" className="px-1.5 py-0 text-[10px]">Promo</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {stale && (
                                  <span
                                    className="inline-block size-1.5 rounded-full bg-amber-500 dark:bg-amber-400"
                                    title="Stale — not recently re-checked"
                                  />
                                )}
                                <span>
                                  {stale ? "Last seen " : ""}
                                  {format(new Date(latestPrice.timestamp), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {/* Price change indicator (semantic green/red) */}
                              {(() => {
                                const previousPrice = getPreviousPrice(product.prices, retailer, latestPrice)
                                const priceChange = calculatePriceChange(latestPrice, previousPrice)
                                if (priceChange !== null) {
                                  return (
                                    <div className={`flex items-center text-xs tabular-nums ${getPriceChangeColor(priceChange)}`}>
                                      {getPriceChangeIcon(priceChange)}
                                      {Math.abs(priceChange).toFixed(1)}%
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {latestUpdate
                      ? format(new Date(latestUpdate.timestamp), 'MMM d, yyyy')
                      : "—"}
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={displayedRetailers.length + 3} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground opacity-30 mb-2" />
                    <p className="text-muted-foreground">No products found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-muted-foreground mt-4 px-2">
        <div className="mb-2 sm:mb-0">
          Showing <span className="font-medium text-foreground">{filteredProducts.length}</span> of <span className="font-medium text-foreground">{products.length}</span> products
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {freshnessFilter !== "all" && (
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              {FRESHNESS_LABEL[freshnessFilter]}
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="secondary">
              <Filter className="h-3 w-3 mr-1" />
              {categoryMap.get(categoryFilter) || categoryFilter}
            </Badge>
          )}
          {retailerFilter !== "all" && (
            <Badge variant="secondary">
              <Package className="h-3 w-3 mr-1" />
              {retailerFilter}
            </Badge>
          )}
          {search.trim() !== "" && (
            <Badge variant="secondary">
              <Search className="h-3 w-3 mr-1" />
              &quot;{search}&quot;
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

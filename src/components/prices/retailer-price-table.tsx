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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { format, subDays } from "date-fns"
import { Product, Price } from "@/types/database"
import { RETAILERS } from "@/lib/config/retailers"
import { Card, CardContent } from "@/components/ui/card"
import {
  Search,
  Tag,
  Filter,
  Package,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface RetailerPriceTableProps {
  products: ProductWithPrices[]
}

export function RetailerPriceTable({ products }: RetailerPriceTableProps) {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [retailerFilter, setRetailerFilter] = useState<string>("all")
  const [outOfDateFilter, setOutOfDateFilter] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClientClient()

  // Get unique category IDs from products
  const categories = Array.from(new Set(products.map(p => p.category_id).filter(Boolean)))
  
  // Get unique retailers that have associations with any product
  const relevantRetailers = Array.from(new Set(
    products.flatMap(product => 
      product.prices?.map(p => p.retailer) || []
    )
  )).filter(Boolean);
  
  // Use these for the retailer filter and headers
  const availableRetailers = relevantRetailers.length > 0 ? relevantRetailers : RETAILERS;

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

  // Price deltas use neutral directional treatment (muted ▲/▼), not red/green —
  // a price moving up or down isn't inherently good or bad to the user.
  const getPriceChangeColor = (change: number | null) => {
    if (change === null) return ""
    return "text-muted-foreground"
  }

  const getPriceChangeIcon = (change: number | null) => {
    if (change === null) return null
    if (change > 0) return <ArrowUp className="h-3 w-3 mr-0.5" />
    if (change < 0) return <ArrowDown className="h-3 w-3 mr-0.5" />
    return <Minus className="h-3 w-3 mr-0.5" />
  }

  // Removed unused isPriceOutdated function
  // const isPriceOutdated = (timestamp: string, days = 14) => {
  //   const cutoffDate = subDays(new Date(), days)
  //   return isBefore(new Date(timestamp), cutoffDate)
  // }

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

    // Apply out-of-date filter
    let outOfDateMatch = true
    if (outOfDateFilter !== null) {
      const cutoffDate = subDays(new Date(), outOfDateFilter)
      const hasRecentPrice = product.prices?.some(p => 
        new Date(p.timestamp) >= cutoffDate &&
        (retailerFilter === "all" || p.retailer === retailerFilter)
      )
      outOfDateMatch = !hasRecentPrice
    }

    return searchMatch && categoryMatch && retailerMatch && outOfDateMatch
  })

  const getLatestPrice = (prices: Price[] | undefined, retailer: string) => {
    if (!prices) return null;
    const retailerPrices = prices.filter(p => p.retailer === retailer)
    if (retailerPrices.length === 0) return null

    return retailerPrices.reduce((latest, current) => {
      if (!latest) return current
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    }, retailerPrices[0])
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:gap-4 items-start md:items-center">
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
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
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

              {/* Age Filter */}
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={outOfDateFilter?.toString() || "none"}
                  onValueChange={(val) => setOutOfDateFilter(val === "none" ? null : parseInt(val))}
                >
                  <SelectTrigger className="w-[140px] border-none shadow-none bg-transparent">
                    <SelectValue placeholder="Price Age" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Prices</SelectItem>
                    <SelectItem value="7">Older than 7 days</SelectItem>
                    <SelectItem value="14">Older than 14 days</SelectItem>
                    <SelectItem value="30">Older than 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="w-full md:flex-1 flex justify-start md:justify-end">
              <Button
                variant="brand"
                onClick={() => router.push('/dashboard/prices/check')}
                className="w-full md:w-auto whitespace-nowrap"
              >
                <Tag className="mr-2 h-4 w-4" />
                Record New Prices
              </Button>
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
              <TableHead className="w-[120px] min-w-[120px]">
                Category
              </TableHead>
              {(retailerFilter === "all" ? availableRetailers : [retailerFilter]).map(retailer => (
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
              const latestUpdate = product.prices?.reduce((latest, current) => {
                if (!latest) return current
                return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
              }, product.prices[0])

              return (
                <TableRow key={product.id}>
                  <TableCell className="sticky left-0 z-10 bg-background border-r border-border font-medium max-w-[200px]">
                    <div className="truncate">{product.name}</div>
                  </TableCell>
                  <TableCell className="max-w-[120px] text-muted-foreground">
                    <div className="truncate">{product.category_id}</div>
                  </TableCell>
                  {(retailerFilter === "all" ? availableRetailers : [retailerFilter]).map(retailer => {
                    const latestPrice = getLatestPrice(product.prices, retailer)
                    // Check if this product has an association with this retailer
                    // Based on existing price records
                    const hasRetailerAssociation = latestPrice !== null;

                    return (
                      <TableCell key={retailer} className="text-center align-middle">
                        {hasRetailerAssociation ? (
                          latestPrice ? (
                            (latestPrice.status === 'out_of_stock' || latestPrice.is_sold_out === true || (latestPrice.price === 0 && latestPrice.is_sold_out !== false)) ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="muted">Sold out</Badge>
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
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(latestPrice.timestamp), 'MMM d, yyyy')}
                                </div>
                                {/* Price change indicator (neutral) */}
                                {(() => {
                                  const previousPrice = getPreviousPrice(product.prices, retailer, latestPrice)
                                  const priceChange = calculatePriceChange(latestPrice, previousPrice)
                                  const changeColor = getPriceChangeColor(priceChange)
                                  const changeIcon = getPriceChangeIcon(priceChange)

                                  if (priceChange !== null) {
                                    return (
                                      <div className={`flex items-center text-xs tabular-nums ${changeColor}`}>
                                        {changeIcon}
                                        {Math.abs(priceChange).toFixed(1)}%
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            )
                          ) : (
                            // Product is associated with retailer but price is missing
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Missing</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-brand hover:text-brand"
                                onClick={() => router.push(`/dashboard/prices/check?retailer=${encodeURIComponent(retailer)}&product=${product.id}`)}
                              >
                                Add price
                              </Button>
                            </div>
                          )
                        ) : (
                          // Product is not associated with this retailer
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {latestUpdate ? (
                      format(new Date(latestUpdate.timestamp), 'MMM d, yyyy h:mm a')
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={availableRetailers.length + 3} className="text-center py-8">
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
          {outOfDateFilter && (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              Older than {outOfDateFilter} days
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="secondary">
              <Filter className="h-3 w-3 mr-1" />
              {categoryFilter}
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
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
import { RETAILER_COLOR_MAP, BRAND_COLORS } from "@/lib/config/colors"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Search, 
  Tag,
  Filter,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
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

  const getPriceChangeColor = (change: number | null) => {
    if (change === null) return ""
    if (change > 0) return "text-red-500 dark:text-red-400"
    if (change < 0) return "text-green-500 dark:text-green-400"
    return "text-gray-500 dark:text-gray-400"
  }

  const getPriceChangeIcon = (change: number | null) => {
    if (change === null) return null
    if (change > 0) return <TrendingUp className="h-3 w-3 mr-1" />
    if (change < 0) return <TrendingDown className="h-3 w-3 mr-1" />
    return <Minus className="h-3 w-3 mr-1" />
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
      <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:gap-4 items-start md:items-center">
            <div className="w-full md:w-auto relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full md:w-[240px] h-10 bg-white dark:bg-gray-800 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-md shadow-sm px-2 py-1">
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
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-md shadow-sm px-2 py-1">
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
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-md shadow-sm px-2 py-1">
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
                onClick={() => router.push('/dashboard/prices/check')}
                className="w-full md:w-auto whitespace-nowrap bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg"
              >
                <Tag className="mr-2 h-4 w-4" />
                Record New Prices
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-x-auto">
        <Table className="w-full">
          <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <TableRow>
              <TableHead className="sticky left-0 font-semibold text-gray-700 dark:text-gray-300 w-[200px] min-w-[200px] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                Product
              </TableHead>
              <TableHead className="font-semibold text-gray-700 dark:text-gray-300 w-[120px] min-w-[120px]">
                Category
              </TableHead>
              {(retailerFilter === "all" ? availableRetailers : [retailerFilter]).map(retailer => (
                <TableHead 
                  key={retailer} 
                  className="font-semibold text-gray-700 dark:text-gray-300 w-[140px] min-w-[140px] text-center"
                  style={{ 
                    borderBottom: `2px solid ${RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.primary}20` 
                  }}
                >
                  {retailer}
                </TableHead>
              ))}
              <TableHead className="font-semibold text-gray-700 dark:text-gray-300 w-[160px] min-w-[160px]">
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
                <TableRow key={product.id} className="h-[80px]">
                  <TableCell className="sticky left-0 bg-white dark:bg-gray-950 font-medium truncate max-w-[200px] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="truncate">{product.name}</div>
                  </TableCell>
                  <TableCell className="truncate max-w-[120px]">
                    <div className="truncate">{product.category_id}</div>
                  </TableCell>
                  {(retailerFilter === "all" ? availableRetailers : [retailerFilter]).map(retailer => {
                    const latestPrice = getLatestPrice(product.prices, retailer)
                    // Check if this product has an association with this retailer
                    // Based on existing price records
                    const hasRetailerAssociation = latestPrice !== null;
                    
                    return (
                      <TableCell key={retailer} className="text-center p-2 h-[80px] align-middle">
                        {hasRetailerAssociation ? (
                          latestPrice ? (
                            (latestPrice.status === 'out_of_stock' || latestPrice.is_sold_out === true || (latestPrice.price === 0 && latestPrice.is_sold_out !== false)) ? (
                              <div className="flex flex-col items-center justify-center h-full">
                                <div className="bg-red-500 dark:bg-red-700 h-10 w-full rounded opacity-90 flex items-center justify-center">
                                  <span className="text-sm font-medium text-white">Sold Out</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(latestPrice.timestamp), 'MMM d, yyyy')}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full">
                                <div className="text-lg font-semibold">${latestPrice.price.toFixed(2)}</div>
                                {latestPrice.is_promotion && (
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                                    Promo
                                  </span>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(latestPrice.timestamp), 'MMM d, yyyy')}
                                </div>
                                {/* Price change indicator */}
                                {(() => {
                                  const previousPrice = getPreviousPrice(product.prices, retailer, latestPrice)
                                  const priceChange = calculatePriceChange(latestPrice, previousPrice)
                                  const changeColor = getPriceChangeColor(priceChange)
                                  const changeIcon = getPriceChangeIcon(priceChange)
                                  
                                  if (priceChange !== null) {
                                    return (
                                      <div className={`flex items-center text-xs ${changeColor} mt-1`}>
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
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-gray-200 dark:bg-gray-700 h-10 w-full rounded opacity-80 flex items-center justify-center">
                                <span className="text-sm text-muted-foreground">Missing</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-xs mt-1 h-6 px-2 text-blue-600 dark:text-blue-400"
                                onClick={() => router.push(`/dashboard/prices/check?retailer=${encodeURIComponent(retailer)}&product=${product.id}`)}
                              >
                                Add price
                              </Button>
                            </div>
                          )
                        ) : (
                          // Product is not associated with this retailer
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="bg-black dark:bg-gray-900 h-10 w-full rounded opacity-80 flex items-center justify-center">
                              <span className="text-sm text-white dark:text-gray-400">Not Available</span>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-sm text-muted-foreground">
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
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
              <Clock className="h-3 w-3 mr-1" />
              Older than {outOfDateFilter} days
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
              <Filter className="h-3 w-3 mr-1" />
              {categoryFilter}
            </Badge>
          )}
          {retailerFilter !== "all" && (
            <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
              <Package className="h-3 w-3 mr-1" />
              {retailerFilter}
            </Badge>
          )}
          {search.trim() !== "" && (
            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
              <Search className="h-3 w-3 mr-1" />
              &quot;{search}&quot;
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RETAILERS } from "@/lib/config/retailers"
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus, 
  X,
  Package,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  name: string
  brand_name?: string
  brand_type?: string
  category_id: string
}

interface Price {
  id: string
  product_id: string
  retailer: string
  price: number | null
  original_price?: number | null
  on_sale?: boolean
  is_promotion?: boolean  // Old field name
  discount_percentage?: number | null
  status?: string
  is_sold_out?: boolean  // Old field name
  timestamp: string
}

interface EnhancedProductComparisonProps {
  products: Product[]
  prices: Price[]
  categories: Array<{ id: string; name: string }>
}

export function EnhancedProductComparison({ 
  products, 
  prices, 
  categories 
}: EnhancedProductComparisonProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [comparisonView, setComparisonView] = useState<"grid" | "chart">("grid")
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false)
  const [selectedRetailer, setSelectedRetailer] = useState<string>("all")
  
  // Get category name helper
  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || "Unknown"
  }
  
  // Add product to comparison
  const addProduct = (productId: string) => {
    if (selectedProducts.length < 5 && !selectedProducts.includes(productId)) {
      setSelectedProducts([...selectedProducts, productId])
    }
  }
  
  // Remove product from comparison
  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(id => id !== productId))
  }
  
  // Get latest price for a product at a retailer
  const getLatestPrice = (productId: string, retailer: string): Price | null => {
    const productPrices = prices
      .filter(p => p.product_id === productId && p.retailer === retailer)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return productPrices[0] || null
  }
  
  // Calculate price statistics
  const calculateStats = (productId: string) => {
    const productPrices = prices
      .filter(p => p.product_id === productId && p.price !== null)
      .map(p => p.price as number)
    
    if (productPrices.length === 0) return null
    
    const min = Math.min(...productPrices)
    const max = Math.max(...productPrices)
    const avg = productPrices.reduce((a, b) => a + b, 0) / productPrices.length
    
    return { min, max, avg }
  }
  
  // Get price difference percentage
  const getPriceDifference = (price1: number | null, price2: number | null) => {
    if (!price1 || !price2) return null
    const diff = ((price2 - price1) / price1) * 100
    return diff
  }
  
  // Group products by brand
  const groupedProducts = products.reduce((acc, product) => {
    const brand = product.brand_type === 'wahlburgers' ? 'Wahlburgers' : (product.brand_name || 'Other')
    if (!acc[brand]) acc[brand] = []
    acc[brand].push(product)
    return acc
  }, {} as Record<string, Product[]>)
  
  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id))
  
  return (
    <div className="space-y-6">
      {/* Product Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Products to Compare
          </CardTitle>
          <CardDescription>
            Choose up to 5 products to compare prices across retailers (Currently selected: {selectedProducts.length}/5)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick select buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedProducts([])}
              disabled={selectedProducts.length === 0}
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const wahlburgers = products
                  .filter(p => p.brand_type === 'wahlburgers')
                  .slice(0, 5)
                  .map(p => p.id)
                setSelectedProducts(wahlburgers)
              }}
            >
              Select Wahlburgers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const competitors = products
                  .filter(p => p.brand_type === 'competitor')
                  .slice(0, 5)
                  .map(p => p.id)
                setSelectedProducts(competitors)
              }}
            >
              Select Competitors
            </Button>
          </div>
          
          {/* Product selection by brand */}
          <div className="space-y-4">
            {Object.entries(groupedProducts).map(([brand, brandProducts]) => (
              <div key={brand} className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  {brand === 'Wahlburgers' && <span className="text-yellow-600">⭐</span>}
                  {brand}
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {brandProducts.map(product => {
                    const isSelected = selectedProducts.includes(product.id)
                    const stats = calculateStats(product.id)
                    
                    return (
                      <Button
                        key={product.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "justify-start text-left h-auto py-2 px-3",
                          isSelected && "ring-2 ring-primary"
                        )}
                        onClick={() => isSelected ? removeProduct(product.id) : addProduct(product.id)}
                        disabled={!isSelected && selectedProducts.length >= 5}
                      >
                        <div className="w-full">
                          <div className="font-medium text-xs truncate">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getCategoryName(product.category_id)}
                          </div>
                          {stats && (
                            <div className="text-xs mt-1">
                              ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Comparison Table */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Price Comparison
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-differences"
                    checked={showOnlyDifferences}
                    onCheckedChange={setShowOnlyDifferences}
                  />
                  <Label htmlFor="show-differences" className="text-sm">
                    Show only differences
                  </Label>
                </div>
                <Select value={selectedRetailer} onValueChange={setSelectedRetailer}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by retailer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Retailers</SelectItem>
                    {RETAILERS.map(retailer => (
                      <SelectItem key={retailer} value={retailer}>
                        {retailer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Retailer</TableHead>
                    {selectedProductsData.map(product => (
                      <TableHead key={product.id} className="text-center min-w-[150px]">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {product.brand_type === 'wahlburgers' && (
                              <span className="text-yellow-600 mr-1">⭐</span>
                            )}
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {product.brand_name || 'Wahlburgers'}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeProduct(product.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RETAILERS
                    .filter(retailer => selectedRetailer === "all" || retailer === selectedRetailer)
                    .map(retailer => {
                      const retailerPrices = selectedProductsData.map(product => 
                        getLatestPrice(product.id, retailer)
                      )
                      
                      // Skip row if showing only differences and all prices are the same
                      if (showOnlyDifferences) {
                        const uniquePrices = new Set(retailerPrices.map(p => p?.price))
                        if (uniquePrices.size <= 1) return null
                      }
                      
                      // Find min and max prices for highlighting
                      const validPrices = retailerPrices
                        .filter(p => p?.price !== null && p?.price !== undefined)
                        .map(p => p!.price!)
                      const minPrice = Math.min(...validPrices)
                      const maxPrice = Math.max(...validPrices)
                      
                      return (
                        <TableRow key={retailer}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {retailer}
                          </TableCell>
                          {retailerPrices.map((price, index) => {
                            const product = selectedProductsData[index]
                            const isLowest = price?.price === minPrice && validPrices.length > 1
                            const isHighest = price?.price === maxPrice && validPrices.length > 1
                            
                            return (
                              <TableCell key={product.id} className="text-center">
                                {price ? (
                                  <div className="space-y-1">
                                    {/* Check if price is available (handle both old and new status fields) */}
                                    {((!price.status || price.status === 'available' || price.status === 'active') && 
                                      price.price !== null && price.price !== undefined && !price.is_sold_out) ? (
                                      <>
                                        <div className={cn(
                                          "font-medium text-lg",
                                          isLowest && "text-green-600",
                                          isHighest && "text-red-600"
                                        )}>
                                          ${price.price.toFixed(2)}
                                        </div>
                                        {/* Handle both on_sale and is_promotion fields */}
                                        {(price.on_sale || price.is_promotion) && price.original_price && (
                                          <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground line-through">
                                              ${price.original_price.toFixed(2)}
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                              {price.discount_percentage || 
                                                Math.round(((price.original_price - price.price) / price.original_price) * 100)}% off
                                            </Badge>
                                          </div>
                                        )}
                                        {isLowest && (
                                          <Badge variant="outline" className="text-xs bg-green-50">
                                            <TrendingDown className="h-3 w-3 mr-1" />
                                            Lowest
                                          </Badge>
                                        )}
                                        {isHighest && (
                                          <Badge variant="outline" className="text-xs bg-red-50">
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                            Highest
                                          </Badge>
                                        )}
                                      </>
                                    ) : (price.status === 'out_of_stock' || price.is_sold_out) ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <XCircle className="h-4 w-4 text-red-500" />
                                        <span className="text-xs text-red-500">Out of Stock</span>
                                      </div>
                                    ) : price.status === 'not_carried' ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <AlertCircle className="h-4 w-4 text-gray-400" />
                                        <span className="text-xs text-gray-400">Not Available</span>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <Minus className="h-4 w-4 text-gray-300" />
                                        <span className="text-xs text-gray-300">No Price</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <Minus className="h-4 w-4 text-gray-300" />
                                    <span className="text-xs text-gray-300">No Data</span>
                                  </div>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })
                    .filter(Boolean)}
                  
                  {/* Summary Row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="sticky left-0 bg-muted/50 z-10">
                      Average Price
                    </TableCell>
                    {selectedProductsData.map(product => {
                      const stats = calculateStats(product.id)
                      return (
                        <TableCell key={product.id} className="text-center">
                          {stats ? (
                            <div className="space-y-1">
                              <div className="text-lg">${stats.avg.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">
                                Range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
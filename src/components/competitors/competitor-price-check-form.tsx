// src/components/competitors/competitor-price-check-form.tsx
"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Save, Tag } from "lucide-react"

interface ProductUrl {
  retailer: string
  url: string
}

interface CompetitorProduct {
  id: string
  name: string
  competitor: string
  competitor_id: string
  category: string
  urls: ProductUrl[]
}

interface CompetitorPriceCheckFormProps {
  products: CompetitorProduct[]
  retailer: string
}

export function CompetitorPriceCheckForm({ products, retailer }: CompetitorPriceCheckFormProps) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [promos, setPromos] = useState<Record<string, boolean>>({})
  const [soldOut, setSoldOut] = useState<Record<string, boolean>>({})
  // Removed unused notes and setNotes variables
  const [category, setCategory] = useState("all")
  const [competitorFilter, setCompetitorFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()
  
  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category)))
  
  // Get unique competitors from products
  const competitors = Array.from(new Set(products.map(p => p.competitor)))
  
  // Filter products by category and competitor
  const filteredProducts = products.filter(p => 
    (category === "all" || p.category === category) &&
    (competitorFilter === "all" || p.competitor === competitorFilter)
  )
  
  // Reference for inputs to enable keyboard navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  
  const handlePriceChange = (productId: string, value: string) => {
    setPrices(prev => ({
      ...prev,
      [productId]: value
    }))
    
    // Update progress
    updateProgress()
  }
  
  const handlePromoToggle = (productId: string, checked: boolean) => {
    setPromos(prev => ({
      ...prev,
      [productId]: checked
    }))
  }
  
  const handleSoldOutToggle = (productId: string, checked: boolean) => {
    setSoldOut(prev => ({
      ...prev,
      [productId]: checked
    }))
    
    // If marking as sold out, clear the price
    if (checked) {
      setPrices(prev => ({
        ...prev,
        [productId]: ''
      }))
    }
  }
  
  const updateProgress = () => {
    const filledCount = Object.keys(prices).filter(id => 
      prices[id] && prices[id] !== "" || soldOut[id]
    ).length
    
    setProgress(Math.round((filledCount / (filteredProducts.length || 1)) * 100))
  }
  
  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Transform data for submission
      const priceUpdates = Object.keys(prices)
        .filter(productId => (prices[productId] && prices[productId] !== "") || soldOut[productId])
        .map(productId => ({
          competitor_product_id: productId,
          retailer,
          price: soldOut[productId] ? 0 : parseFloat(prices[productId]),
          is_promotion: promos[productId] || false,
          is_sold_out: soldOut[productId] || false,
          status: 'active',
          timestamp: new Date().toISOString()
        }))
      
      if (priceUpdates.length === 0) {
        toast({
          icon: <AlertTriangle className="size-5" />,
          title: "No prices entered",
          description: "Please enter at least one price or mark products as sold out before submitting",
          variant: "destructive"
        })
        setLoading(false)
        return
      }
      
      // First update status of existing prices to historical
      const { error: updateError } = await supabase
        .from('competitor_prices')
        .update({ status: 'historical' })
        .eq('retailer', retailer)
        .in('competitor_product_id', priceUpdates.map(p => p.competitor_product_id))
        .eq('status', 'active')
      
      if (updateError) throw new Error(`Failed to update existing prices: ${updateError.message}`)
      
      // Then insert new prices
      const { error: insertError } = await supabase
        .from('competitor_prices')
        .insert(priceUpdates)
      
      if (insertError) throw new Error(`Failed to insert new prices: ${insertError.message}`)
      
      toast({
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: `Competitor price check for ${retailer} completed successfully`,
      })
      
      router.push('/dashboard/comparison')
      router.refresh()
    } catch (error) {
      console.error("Error saving prices:", error)
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save price check data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Get product URL for this retailer
  const getProductUrl = (product: CompetitorProduct) => {
    if (!product.urls || product.urls.length === 0) return null
    const urlData = product.urls.find(u => u.retailer === retailer)
    return urlData?.url
  }
  
  return (
    <div className="space-y-6">
      {filteredProducts.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-80" />
            <h3 className="text-lg font-medium mb-2">
              {category !== "all" || competitorFilter !== "all"
                ? "No products match your filters" 
                : "No competitor products available for price checking"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {category !== "all" || competitorFilter !== "all"
                ? "Try changing your category or competitor filter." 
                : "Try adding competitor products or setting up retailer URLs in the product management section."}
            </p>
            {(category !== "all" || competitorFilter !== "all") && (
              <Button onClick={() => {
                setCategory("all")
                setCompetitorFilter("all")
              }}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-2 bg-brand"
                ></div>
                Competitor Price Check: {retailer}
              </CardTitle>
              
              <div className="flex flex-wrap gap-2">
                {categories.length > 1 && (
                  <select
                    className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
                
                {competitors.length > 1 && (
                  <select
                    className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={competitorFilter}
                    onChange={(e) => setCompetitorFilter(e.target.value)}
                  >
                    <option value="all">All Competitors</option>
                    {competitors.map(comp => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="relative pt-4 mb-6">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progress}% Complete</span>
              </div>
            </div>
            
            <div className="space-y-6">
              {categories.map(cat => {
                // Only show this category section if we're showing all categories or this specific one
                if (category !== "all" && category !== cat) return null
                
                const categoryProducts = filteredProducts.filter(p => p.category === cat)
                if (categoryProducts.length === 0) return null
                
                return (
                  <div key={cat} className="space-y-3">
                    <h3 className="font-medium border-b pb-2 text-sm uppercase tracking-wide text-muted-foreground">
                      {cat} <Badge variant="outline">{categoryProducts.length}</Badge>
                    </h3>
                    
                    <div className="grid gap-4">
                      {categoryProducts.map((product, index) => {
                        const productUrl = getProductUrl(product)
                        
                        return (
                          <div 
                            key={product.id} 
                            className="grid grid-cols-[2fr,1fr,auto,auto,auto] gap-4 items-center p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                          >
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-muted-foreground">{product.competitor}</div>
                            </div>
                            
                            <div className="flex items-center">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-8 w-28 font-medium text-right"
                                  value={prices[product.id] || ''}
                                  onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                  ref={(el) => { if (el) inputRefs.current[product.id] = el }}
                                  disabled={soldOut[product.id]}
                                  onKeyDown={(e) => {
                                    // Handle tab navigation based on index
                                    if (e.key === 'Enter') {
                                      // If Enter key is pressed, focus the next input if exists
                                      const nextIndex = index + 1
                                      if (nextIndex < categoryProducts.length) {
                                        const nextProductId = categoryProducts[nextIndex].id
                                        inputRefs.current[nextProductId]?.focus()
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`promo-${product.id}`}
                                checked={promos[product.id] || false}
                                onCheckedChange={(checked) => handlePromoToggle(product.id, checked)}
                                disabled={soldOut[product.id]}
                              />
                              <Label htmlFor={`promo-${product.id}`} className="cursor-pointer">
                                <Tag className="h-4 w-4 text-muted-foreground inline mr-1" />
                                Promo
                              </Label>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`soldout-${product.id}`}
                                checked={soldOut[product.id] || false}
                                onCheckedChange={(checked) => handleSoldOutToggle(product.id, checked)}
                              />
                              <Label htmlFor={`soldout-${product.id}`} className="cursor-pointer">
                                <AlertCircle className="h-4 w-4 text-muted-foreground inline mr-1" />
                                Sold Out
                              </Label>
                            </div>
                            
                            {productUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(productUrl, '_blank')}
                                className="text-muted-foreground"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="flex justify-end mt-8">
              <Button
                className="w-full sm:w-auto"
                onClick={handleSubmit}
                disabled={loading || progress === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Save Competitor Prices"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { ExternalLink, Tag, Check, Info, AlertCircle, TrendingDown, ChevronRight, XCircle } from "lucide-react"
import { RETAILER_COLOR_MAP, BRAND_COLORS } from "@/lib/config/colors"
import { RETAILERS } from "@/lib/config/retailers"

// Define the simplified interfaces for the form component
interface SimpleProductUrl {
  retailer: string
  url: string
}

interface SimpleProduct {
  id: string
  name: string
  category: string
  urls: SimpleProductUrl[]
}

interface PriceCheckFormProps {
  products: SimpleProduct[]
  retailer: string
}

export function PriceCheckForm({ products, retailer }: PriceCheckFormProps) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [originalPrices, setOriginalPrices] = useState<Record<string, string>>({})
  const [promos, setPromos] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState("")
  const [category, setCategory] = useState("all")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [soldOut, setSoldOut] = useState<Record<string, boolean>>({})
  const [notAvailable, setNotAvailable] = useState<Record<string, boolean>>({})
  const [openingUrls, setOpeningUrls] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()
  
  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category)))
  
  // Filter products by category
  const filteredProducts = category === "all" 
    ? products 
    : products.filter(p => p.category === category)
  
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
    
    // Clear original price if promo is unchecked
    if (!checked) {
      setOriginalPrices(prev => ({
        ...prev,
        [productId]: ''
      }))
    }
  }
  
  const handleOriginalPriceChange = (productId: string, value: string) => {
    setOriginalPrices(prev => ({
      ...prev,
      [productId]: value
    }))
    
    // Auto-detect promotion if original price is higher than regular price
    if (value && prices[productId]) {
      const original = parseFloat(value)
      const regular = parseFloat(prices[productId])
      if (!isNaN(original) && !isNaN(regular) && original > regular) {
        setPromos(prev => ({
          ...prev,
          [productId]: true
        }))
      }
    }
  }
  
  // Add a handler for the sold out toggle
  const handleSoldOutToggle = (productId: string, checked: boolean) => {
    // Update soldOut state
    setSoldOut(prev => {
      const newSoldOut = {
        ...prev,
        [productId]: checked
      };
      
      // If marking as sold out, clear price, disable promo, and clear not available
      if (checked) {
        setPrices(prev => ({
          ...prev,
          [productId]: ''
        }));
        setPromos(prev => ({
          ...prev,
          [productId]: false
        }));
        setNotAvailable(prev => ({
          ...prev,
          [productId]: false
        }));
      }
      
      // Calculate progress with the updated soldOut state
      setTimeout(() => {
        const filledCount = Object.keys(prices).filter(id => prices[id] && prices[id] !== "").length;
        const soldOutCount = Object.keys(newSoldOut).filter(id => newSoldOut[id]).length;
        const notAvailableCount = Object.keys(notAvailable).filter(id => notAvailable[id]).length;
        setProgress(Math.round(((filledCount + soldOutCount + notAvailableCount) / (filteredProducts.length || 1)) * 100));
      }, 0);
      
      return newSoldOut;
    });
  }
  
  // Add a handler for the not available toggle
  const handleNotAvailableToggle = (productId: string, checked: boolean) => {
    // Update notAvailable state
    setNotAvailable(prev => {
      const newNotAvailable = {
        ...prev,
        [productId]: checked
      };
      
      // If marking as not available, clear everything else
      if (checked) {
        setPrices(prev => ({
          ...prev,
          [productId]: ''
        }));
        setPromos(prev => ({
          ...prev,
          [productId]: false
        }));
        setSoldOut(prev => ({
          ...prev,
          [productId]: false
        }));
      }
      
      // Calculate progress
      setTimeout(() => {
        const filledCount = Object.keys(prices).filter(id => prices[id] && prices[id] !== "").length;
        const soldOutCount = Object.keys(soldOut).filter(id => soldOut[id]).length;
        const notAvailableCount = Object.keys(newNotAvailable).filter(id => newNotAvailable[id]).length;
        setProgress(Math.round(((filledCount + soldOutCount + notAvailableCount) / (filteredProducts.length || 1)) * 100));
      }, 0);
      
      return newNotAvailable;
    });
  }
  
  const updateProgress = () => {
    const filledCount = Object.keys(prices).filter(id => prices[id] && prices[id] !== "").length
    const soldOutCount = Object.keys(soldOut).filter(id => soldOut[id]).length
    const notAvailableCount = Object.keys(notAvailable).filter(id => notAvailable[id]).length
    setProgress(Math.round(((filledCount + soldOutCount + notAvailableCount) / (filteredProducts.length || 1)) * 100))
  }
  
  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Get all product IDs that have either a price or are marked as sold out or not available
      const productIdsWithData = Array.from(new Set([
        ...Object.keys(prices).filter(id => prices[id] && prices[id] !== ""),
        ...Object.keys(soldOut).filter(id => soldOut[id]),
        ...Object.keys(notAvailable).filter(id => notAvailable[id])
      ]));
      
      // Transform data for submission
      const priceUpdates = productIdsWithData
        .map(productId => {
          const hasPromo = promos[productId] || false
          const originalPrice = hasPromo && originalPrices[productId] ? parseFloat(originalPrices[productId]) : null
          // For sold out or not available items, use 0 as the price
          // For available items, parse the price or skip if no price entered
          let regularPrice: number | null = null

          if (soldOut[productId] || notAvailable[productId]) {
            regularPrice = 0 // Use 0 for sold out or not available items
          } else if (prices[productId]) {
            regularPrice = parseFloat(prices[productId])
          }

          // Skip items that don't have a price and aren't marked as sold out or not available
          if (regularPrice === null) {
            return null
          }

          return {
            product_id: productId,
            retailer,
            price: regularPrice,
            original_price: originalPrice,
            on_sale: hasPromo,
            discount_percentage: hasPromo && originalPrice && regularPrice > 0
              ? Math.round(((originalPrice - regularPrice) / originalPrice) * 100)
              : null,
            status: notAvailable[productId] ? 'not_carried' : (soldOut[productId] ? 'out_of_stock' : 'available'),
            timestamp: new Date().toISOString()
          }
        })
        .filter(update => update !== null) // Remove any null entries
      
      if (priceUpdates.length === 0) {
        toast({
          title: "No prices entered",
          description: "Please enter at least one price or mark a product as sold out before submitting",
          variant: "destructive"
        })
        setLoading(false)
        return
      }
      
      // Add price check log
      const { error: logError } = await supabase
        .from('price_check_logs')
        .insert({
          retailer,
          completed: true,
          completed_at: new Date().toISOString(),
          notes: notes || null
        })
      
      if (logError) throw new Error(`Failed to create price check log: ${logError.message}`)
      
      // First update status of existing prices to historical
      const { error: updateError } = await supabase
        .from('prices')
        .update({ status: 'historical' })
        .eq('retailer', retailer)
        .in('product_id', priceUpdates.map(p => p.product_id))
        .eq('status', 'active')
      
      if (updateError) throw new Error(`Failed to update existing prices: ${updateError.message}`)
      
      // Then insert new prices
      const { error: insertError } = await supabase
        .from('prices')
        .insert(priceUpdates)
      
      if (insertError) throw new Error(`Failed to insert new prices: ${insertError.message}`)
      
      toast({
        title: "Success",
        description: `Price check for ${retailer} completed successfully`,
      })
      
      // Auto-advance to next retailer if enabled
      if (autoAdvance) {
        const currentIndex = (RETAILERS as readonly string[]).indexOf(retailer)
        if (currentIndex < RETAILERS.length - 1) {
          const nextRetailer = RETAILERS[currentIndex + 1]
          router.push(`/dashboard/prices/check?retailer=${encodeURIComponent(nextRetailer)}`)
        } else {
          // All retailers complete
          toast({
            title: "All Retailers Complete!",
            description: "You've completed price checks for all retailers.",
          })
          router.push('/dashboard/prices')
        }
      } else {
        router.push('/dashboard/prices')
      }
      router.refresh()
    } catch (error) {
      console.error("Error saving prices:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save price check data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Get product URL for this retailer
  const getProductUrl = (product: SimpleProduct) => {
    if (!product.urls || product.urls.length === 0) return null;
    const urlData = product.urls.find(u => u.retailer === retailer);
    return urlData?.url;
  }
  
  // Function to open URLs with a delay to avoid popup blockers
  const openUrlsSequentially = (urls: string[]) => {
    if (urls.length === 0) return;
    
    setOpeningUrls(true);
    
    // Show toast notification with instructions
    toast({
      title: `Opening ${urls.length} URLs`,
      description: "You may need to allow popups in your browser. Check for popup notifications.",
      duration: 5000,
    });
    
    // Create a temporary button element for each URL
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; // Hide off-screen
    document.body.appendChild(container);
    
    // Create and click links with a small delay between each
    let index = 0;
    
    const openNext = () => {
      if (index >= urls.length) {
        // Clean up when done
        document.body.removeChild(container);
        setOpeningUrls(false);
        return;
      }
      
      const link = document.createElement('a');
      link.href = urls[index];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `Open ${index + 1}`;
      link.style.display = 'block';
      link.style.margin = '10px';
      container.appendChild(link);
      
      // Simulate a user click
      link.click();
      
      // Move to next URL after delay
      index++;
      setTimeout(openNext, 300);
    };
    
    // Start the process
    openNext();
  };
  
  return (
    <div className="space-y-6">
      {filteredProducts.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="p-8 text-center">
            <Info className="h-12 w-12 mx-auto mb-4 text-blue-500 opacity-80" />
            <h3 className="text-lg font-medium mb-2">
              {category === "all" 
                ? "No products available for price checking" 
                : `No products in the "${category}" category`}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {category === "all"
                ? "Try adding products or setting up retailer URLs in the product management section."
                : "Try selecting a different category or add products to this category."}
            </p>
            {category !== "all" && (
              <Button onClick={() => setCategory("all")}>
                Show All Products
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: RETAILER_COLOR_MAP[retailer] || BRAND_COLORS.primary }}
                ></div>
                Price Check: {retailer}
              </CardTitle>
              
              {categories.length > 1 && (
                <div className="flex items-center gap-2 self-end">
                  <Label>Category:</Label>
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
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <Label>Notes about this price check:</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this price check..."
                className="h-20"
              />
            </div>
            
            <div className="relative pt-4 mb-6">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progress}% Complete</span>
              </div>
            </div>
            
            {/* Auto-advance toggle */}
            <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                <Label htmlFor="auto-advance" className="cursor-pointer">
                  Auto-advance to next retailer after saving
                </Label>
              </div>
              <Switch
                id="auto-advance"
                checked={autoAdvance}
                onCheckedChange={setAutoAdvance}
              />
            </div>
            
            <div className="space-y-6">
              {categories.map(cat => {
                // Only show this category section if we're showing all categories or this specific one
                if (category !== "all" && category !== cat) return null;
                
                const categoryProducts = products.filter(p => p.category === cat);
                if (categoryProducts.length === 0) return null;
                
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                        {cat} <Badge variant="outline">{categoryProducts.length}</Badge>
                      </h3>
                      
                      {/* Open All URLs button */}
                      {(() => {
                        // Get all valid URLs for this category and retailer
                        const categoryUrls = categoryProducts
                          .map(product => getProductUrl(product))
                          .filter(Boolean) as string[];
                          
                        if (categoryUrls.length > 0) {
                          return (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-7 px-2 text-blue-600 dark:text-blue-400 flex items-center gap-1"
                              onClick={() => openUrlsSequentially(categoryUrls)}
                              disabled={openingUrls}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {openingUrls ? "Opening..." : `Open All URLs (${categoryUrls.length})`}
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    <div className="grid gap-4">
                      {categoryProducts.map((product, index) => {
                        const productUrl = getProductUrl(product);
                        
                        return (
                          <div 
                            key={product.id} 
                            className="grid grid-cols-1 lg:grid-cols-[minmax(200px,1.5fr),minmax(280px,auto),auto,auto,auto] gap-2 lg:gap-4 items-center p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                          >
                            {/* Product name with URL */}
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm lg:text-base truncate">{product.name}</div>
                              {productUrl && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(productUrl, '_blank')}
                                  className="text-muted-foreground h-7 w-7 shrink-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            
                            {/* Price inputs */}
                            <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-7 w-24 h-9 font-medium text-right text-sm"
                                  value={prices[product.id] || ''}
                                  onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                  ref={(el) => { if (el) inputRefs.current[product.id] = el }}
                                  disabled={soldOut[product.id] || notAvailable[product.id]}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const nextIndex = index + 1;
                                      if (nextIndex < categoryProducts.length) {
                                        const nextProductId = categoryProducts[nextIndex].id;
                                        inputRefs.current[nextProductId]?.focus();
                                      }
                                    }
                                  }}
                                />
                              </div>
                              {promos[product.id] && (
                                <div className="relative">
                                  <TrendingDown className="absolute left-2.5 top-1/2 -translate-y-1/2 text-green-500 h-3 w-3" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Orig"
                                    className="pl-7 w-24 h-9 font-medium text-right text-sm border-green-200"
                                    value={originalPrices[product.id] || ''}
                                    onChange={(e) => handleOriginalPriceChange(product.id, e.target.value)}
                                    disabled={soldOut[product.id]}
                                  />
                                </div>
                              )}
                              {promos[product.id] && prices[product.id] && originalPrices[product.id] && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5">
                                  {Math.round(((parseFloat(originalPrices[product.id]) - parseFloat(prices[product.id])) / parseFloat(originalPrices[product.id])) * 100)}%
                                </Badge>
                              )}
                            </div>
                            
                            {/* Promo toggle */}
                            <div className="flex items-center gap-1.5">
                              <Switch
                                id={`promo-${product.id}`}
                                checked={promos[product.id] || false}
                                onCheckedChange={(checked) => handlePromoToggle(product.id, checked)}
                                disabled={soldOut[product.id] || notAvailable[product.id]}
                                className="scale-90"
                              />
                              <Label htmlFor={`promo-${product.id}`} className="cursor-pointer text-xs lg:text-sm whitespace-nowrap">
                                <Tag className="h-3 w-3 lg:h-4 lg:w-4 text-amber-500 inline mr-0.5" />
                                Sale
                              </Label>
                            </div>
                            
                            {/* Sold Out toggle */}
                            <div className="flex items-center gap-1.5">
                              <Switch
                                id={`soldout-${product.id}`}
                                checked={soldOut[product.id] || false}
                                onCheckedChange={(checked) => handleSoldOutToggle(product.id, checked)}
                                disabled={notAvailable[product.id]}
                                className="scale-90"
                              />
                              <Label htmlFor={`soldout-${product.id}`} className="cursor-pointer text-xs lg:text-sm whitespace-nowrap">
                                <AlertCircle className="h-3 w-3 lg:h-4 lg:w-4 text-red-500 inline mr-0.5" />
                                Out
                              </Label>
                            </div>
                            
                            {/* Not Available toggle */}
                            <div className="flex items-center gap-1.5">
                              <Switch
                                id={`notavailable-${product.id}`}
                                checked={notAvailable[product.id] || false}
                                onCheckedChange={(checked) => handleNotAvailableToggle(product.id, checked)}
                                className="scale-90"
                              />
                              <Label htmlFor={`notavailable-${product.id}`} className="cursor-pointer text-xs lg:text-sm whitespace-nowrap">
                                <XCircle className="h-3 w-3 lg:h-4 lg:w-4 text-gray-500 inline mr-0.5" />
                                N/A
                              </Label>
                            </div>
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
                disabled={loading || (Object.keys(prices).filter(id => prices[id] && prices[id] !== "").length === 0 && Object.keys(soldOut).filter(id => soldOut[id]).length === 0 && Object.keys(notAvailable).filter(id => notAvailable[id]).length === 0)}
              >
                <Check className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Complete Price Check"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
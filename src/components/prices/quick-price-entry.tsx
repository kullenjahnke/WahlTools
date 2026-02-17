// src/components/prices/quick-price-entry.tsx
'use client'

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ExternalLink, Save, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClientClient } from "@/lib/supabase/client"

interface RetailerUrl {
  retailer: string
  url: string
}

interface QuickPriceEntryProps {
  productId: string
  productName: string
  retailerUrls: RetailerUrl[]
  currentPrices: {
    retailer: string
    price: number | null
    timestamp: string | null
  }[]
  onPricesUpdated?: () => void
}

export function QuickPriceEntry({ 
  productId, 
  productName,
  retailerUrls, 
  currentPrices,
  onPricesUpdated 
}: QuickPriceEntryProps) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [isPromotion, setIsPromotion] = useState<Record<string, boolean>>({})
  const [promotionNotes, setPromotionNotes] = useState<Record<string, string>>({})
  const [isSoldOut, setIsSoldOut] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  
  const { toast } = useToast()
  const supabase = createClientClient()

  // Open all retailer URLs in new tabs
  const openAllUrls = async () => {
    // Add a small delay between opening each URL to prevent browser blocking
    for (const { retailer, url } of retailerUrls) {
      if (url && url.trim()) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          window.open(url, '_blank', 'noopener,noreferrer')
        } catch (error) {
          console.error(`Failed to open URL for ${retailer}:`, error)
          toast({
            title: "Error",
            description: `Failed to open URL for ${retailer}`,
            variant: "destructive",
          })
        }
      }
    }
  }

  const handlePriceChange = (retailer: string, value: string) => {
    // Allow empty string to clear the input
    if (value === '') {
      setPrices(prev => ({
        ...prev,
        [retailer]: value
      }))
      return
    }

    // Validate price format
    const price = parseFloat(value)
    if (!isNaN(price) && price >= 0) {
      // Limit to 2 decimal places
      const formattedValue = Math.round(price * 100) / 100
      setPrices(prev => ({
        ...prev,
        [retailer]: formattedValue.toString()
      }))
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Validate and prepare price entries
      const priceEntries = Object.entries(prices)
        .filter(([retailer, price]) => price.trim() !== '' || isSoldOut[retailer])
        .map(([retailer, price]) => ({
          product_id: productId,
          retailer,
          price: isSoldOut[retailer] ? 0 : parseFloat(price),
          is_promotion: isPromotion[retailer] || false,
          is_sold_out: isSoldOut[retailer] || false,
          promotion_notes: isPromotion[retailer] ? promotionNotes[retailer] || null : null,
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
          // updated_by will be NULL by default as per schema
        }))

      if (priceEntries.length === 0) {
        throw new Error('Please enter at least one valid price')
      }

      // Update existing prices to historical
      const retailersWithNewPrices = priceEntries.map(entry => entry.retailer)
      const { error: updateError } = await supabase
        .from('prices')
        .update({ 
          status: 'historical',
          updated_at: new Date().toISOString()
        })
        .eq('product_id', productId)
        .eq('status', 'active')
        .in('retailer', retailersWithNewPrices)

      if (updateError) {
        throw new Error(`Failed to update existing prices: ${updateError.message}`)
      }

      // Insert new prices
      const { error: insertError } = await supabase
        .from('prices')
        .insert(priceEntries)
        .select()

      if (insertError) {
        throw new Error(`Failed to save new prices: ${insertError.message}`)
      }

      toast({
        title: "Success",
        description: `Updated prices for ${priceEntries.length} retailers`,
      })

      // Reset form state
      setPrices({})
      setIsPromotion({})
      setPromotionNotes({})
      setIsSoldOut({})
      
      if (onPricesUpdated) {
        onPricesUpdated()
      }
    } catch (error: unknown) {
      console.error('Price save error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save prices. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quick Price Entry - {productName}</CardTitle>
        <Button variant="outline" onClick={openAllUrls}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open All URLs
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {retailerUrls.map(({ retailer, url }) => {
            const currentPrice = currentPrices.find(p => p.retailer === retailer)
            
            return (
              <div key={retailer} className="grid gap-4 items-center md:grid-cols-[1fr,auto,2fr,auto,auto]">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{retailer}</label>
                  {currentPrice?.price && (
                    <p className="text-sm text-muted-foreground">
                      Current: ${currentPrice.price.toFixed(2)}
                    </p>
                  )}
                </div>
                
                {url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    title="No URL configured"
                  >
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}

                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter price"
                    value={prices[retailer] || ''}
                    onChange={(e) => handlePriceChange(retailer, e.target.value)}
                    className="font-mono"
                    disabled={isSoldOut[retailer]}
                  />
                  <Input
                    type="text"
                    placeholder="Promotion details"
                    value={promotionNotes[retailer] || ''}
                    onChange={(e) => setPromotionNotes(prev => ({
                      ...prev,
                      [retailer]: e.target.value
                    }))}
                    className={isPromotion[retailer] ? 'block' : 'hidden md:block'}
                    disabled={isSoldOut[retailer]}
                  />
                </div>

                <Button
                  variant={isPromotion[retailer] ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPromotion(prev => ({
                    ...prev,
                    [retailer]: !prev[retailer]
                  }))}
                  disabled={isSoldOut[retailer]}
                >
                  Promo
                </Button>
                
                <Button
                  variant={isSoldOut[retailer] ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setIsSoldOut(prev => {
                    const newValue = !prev[retailer];
                    if (newValue) {
                      handlePriceChange(retailer, '');
                      setIsPromotion(p => ({...p, [retailer]: false}));
                    }
                    return {...prev, [retailer]: newValue};
                  })}
                >
                  Sold Out
                </Button>
              </div>
            )
          })}

          <div className="flex justify-end mt-6">
            <Button 
              onClick={handleSave} 
              disabled={isLoading || (Object.keys(prices).filter(retailer => prices[retailer] !== '').length === 0 && Object.keys(isSoldOut).filter(retailer => isSoldOut[retailer]).length === 0)}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Prices
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
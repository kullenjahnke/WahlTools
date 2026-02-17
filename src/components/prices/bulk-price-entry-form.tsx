"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { RETAILERS } from "@/lib/config/retailers"
import { 
  Save, 
  Store, 
  DollarSign, 
  Tag,
  AlertCircle,
  Check,
  X,
  TrendingDown
} from "lucide-react"
import { format } from "date-fns"

interface Product {
  id: string
  name: string
  brand_name?: string
  brand_type?: string
}

interface BulkPriceEntryFormProps {
  product: Product
}

interface RetailerPriceEntry {
  retailer: string
  price: string
  originalPrice: string
  status: 'available' | 'out_of_stock' | 'not_carried' | ''
  hasPromotion: boolean
}

const initialRetailerEntry = (retailer: string): RetailerPriceEntry => ({
  retailer,
  price: '',
  originalPrice: '',
  status: '',
  hasPromotion: false
})

export function BulkPriceEntryForm({ product }: BulkPriceEntryFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()
  const [loading, setLoading] = useState(false)
  const [checkDate] = useState(new Date())
  
  // Initialize state for all retailers
  const [retailerPrices, setRetailerPrices] = useState<RetailerPriceEntry[]>(
    RETAILERS.map(retailer => initialRetailerEntry(retailer))
  )

  // Update a specific retailer's price data
  const updateRetailerPrice = (
    index: number, 
    field: keyof RetailerPriceEntry, 
    value: string | boolean
  ) => {
    setRetailerPrices(prev => {
      const updated = [...prev]
      const entry = { ...updated[index] }
      
      if (field === 'price' || field === 'originalPrice') {
        // Handle price fields
        entry[field] = value as string
        
        // Auto-detect promotion if original price is higher than regular price
        if (field === 'originalPrice' && value) {
          const original = parseFloat(value as string)
          const regular = parseFloat(entry.price)
          if (!isNaN(original) && !isNaN(regular) && original > regular) {
            entry.hasPromotion = true
          }
        }
      } else if (field === 'hasPromotion') {
        entry.hasPromotion = value as boolean
        // Clear original price if promotion is unchecked
        if (!value) {
          entry.originalPrice = ''
        }
      } else {
        (entry as unknown as Record<string, string | boolean>)[field] = value
      }
      
      updated[index] = entry
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Filter out retailers with no price entered
    const entriesToSave = retailerPrices.filter(entry => 
      entry.price || entry.status === 'out_of_stock' || entry.status === 'not_carried'
    )
    
    if (entriesToSave.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one price or status",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    
    try {
      // Prepare price records for insertion
      const priceRecords = entriesToSave.map(entry => {
        const baseRecord = {
          product_id: product.id,
          retailer: entry.retailer,
          timestamp: checkDate.toISOString(),
          status: entry.status || 'available',
        }
        
        if (entry.price) {
          return {
            ...baseRecord,
            price: parseFloat(entry.price),
            original_price: entry.originalPrice ? parseFloat(entry.originalPrice) : null,
            on_sale: entry.hasPromotion,
            discount_percentage: entry.hasPromotion && entry.originalPrice
              ? Math.round(((parseFloat(entry.originalPrice) - parseFloat(entry.price)) / parseFloat(entry.originalPrice)) * 100)
              : null
          }
        } else {
          return {
            ...baseRecord,
            price: null,
            original_price: null,
            on_sale: false,
            discount_percentage: null
          }
        }
      })

      // Insert all price records
      const { error } = await supabase
        .from('prices')
        .insert(priceRecords)
      
      if (error) throw error
      
      toast({
        title: "Success",
        description: `Recorded prices for ${entriesToSave.length} retailer${entriesToSave.length > 1 ? 's' : ''}`,
      })
      
      // Navigate back to prices page
      router.push('/dashboard/prices')
      router.refresh()
    } catch (error) {
      console.error('Error saving prices:', error)
      toast({
        title: "Error",
        description: "Failed to save prices. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Count how many retailers have data entered
  const entriesCount = retailerPrices.filter(entry => 
    entry.price || entry.status
  ).length

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {product.name}
              {product.brand_type === 'wahlburgers' && (
                <span className="text-sm font-semibold text-yellow-600 ml-2">⭐ Wahlburgers</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground font-normal">
              {format(checkDate, 'PPP')}
            </div>
          </CardTitle>
          <CardDescription>
            Enter prices for all retailers at once. Leave blank for retailers that don&apos;t carry this product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick fill section */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm">Quick Fill:</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const price = prompt('Enter price to apply to all retailers:')
                  if (price && !isNaN(parseFloat(price))) {
                    setRetailerPrices(prev => prev.map(entry => ({
                      ...entry,
                      price,
                      status: 'available'
                    })))
                  }
                }}
              >
                Set All Prices
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRetailerPrices(prev => prev.map(entry => ({
                    ...entry,
                    status: 'out_of_stock',
                    price: ''
                  })))
                }}
              >
                Mark All Out of Stock
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRetailerPrices(RETAILERS.map(retailer => initialRetailerEntry(retailer)))
                }}
              >
                Clear All
              </Button>
            </div>

            {/* Retailer price entries */}
            <div className="grid gap-4">
              {retailerPrices.map((entry, index) => (
                <Card key={entry.retailer} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    {/* Retailer name */}
                    <div className="md:col-span-1">
                      <Label className="flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {entry.retailer}
                      </Label>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-1">
                      <Select
                        value={entry.status}
                        onValueChange={(value) => updateRetailerPrice(index, 'status', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">
                            <span className="flex items-center gap-2">
                              <Check className="h-3 w-3" />
                              Available
                            </span>
                          </SelectItem>
                          <SelectItem value="out_of_stock">
                            <span className="flex items-center gap-2">
                              <X className="h-3 w-3" />
                              Out of Stock
                            </span>
                          </SelectItem>
                          <SelectItem value="not_carried">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="h-3 w-3" />
                              Not Carried
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Regular Price */}
                    <div className="md:col-span-1">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={entry.price}
                          onChange={(e) => updateRetailerPrice(index, 'price', e.target.value)}
                          className="pl-8 h-9"
                          disabled={entry.status === 'out_of_stock' || entry.status === 'not_carried'}
                        />
                      </div>
                    </div>

                    {/* Promotion checkbox */}
                    <div className="md:col-span-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entry.hasPromotion}
                          onChange={(e) => updateRetailerPrice(index, 'hasPromotion', e.target.checked)}
                          disabled={!entry.price || entry.status === 'out_of_stock' || entry.status === 'not_carried'}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          On Sale
                        </span>
                      </label>
                    </div>

                    {/* Original Price (if on promotion) */}
                    <div className="md:col-span-1">
                      {entry.hasPromotion && (
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Original"
                            value={entry.originalPrice}
                            onChange={(e) => updateRetailerPrice(index, 'originalPrice', e.target.value)}
                            className="pl-8 h-9"
                          />
                        </div>
                      )}
                    </div>

                    {/* Discount percentage display */}
                    <div className="md:col-span-1">
                      {entry.hasPromotion && entry.price && entry.originalPrice && (
                        <div className="text-sm font-medium text-green-600">
                          {Math.round(((parseFloat(entry.originalPrice) - parseFloat(entry.price)) / parseFloat(entry.originalPrice)) * 100)}% off
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                {entriesCount > 0 ? (
                  <span>{entriesCount} retailer{entriesCount !== 1 ? 's' : ''} with data entered</span>
                ) : (
                  <span>No prices entered yet</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/prices')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || entriesCount === 0}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : `Save ${entriesCount} Price${entriesCount !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
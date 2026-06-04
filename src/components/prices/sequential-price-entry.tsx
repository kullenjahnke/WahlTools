"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import {
  ExternalLink,
  Tag,
  Check,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  X,
  AlertCircle,
  XCircle,
  Save,
  TrendingDown,
} from "lucide-react"

interface ProductUrl {
  retailer: string
  url: string
}

interface SequentialProduct {
  id: string
  name: string
  category: string
  urls: ProductUrl[]
}

interface SequentialPriceEntryProps {
  products: SequentialProduct[]
}

export function SequentialPriceEntry({ products }: SequentialPriceEntryProps) {
  const [productIndex, setProductIndex] = useState(0)
  const [retailerIndex, setRetailerIndex] = useState(0)
  const [price, setPrice] = useState("")
  const [originalPrice, setOriginalPrice] = useState("")
  const [isPromo, setIsPromo] = useState(false)
  const [isSoldOut, setIsSoldOut] = useState(false)
  const [isNotAvailable, setIsNotAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const priceInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  const retailers = RETAILERS as readonly string[]
  const totalSteps = products.length * retailers.length
  const currentStep = productIndex * retailers.length + retailerIndex + 1

  const currentProduct = products[productIndex]
  const currentRetailer = retailers[retailerIndex]

  // Get URL for current product + retailer
  const currentUrl = currentProduct?.urls?.find(
    (u) => u.retailer === currentRetailer
  )?.url

  // Focus price input on advance
  useEffect(() => {
    priceInputRef.current?.focus()
  }, [productIndex, retailerIndex])

  const resetForm = () => {
    setPrice("")
    setOriginalPrice("")
    setIsPromo(false)
    setIsSoldOut(false)
    setIsNotAvailable(false)
  }

  const advance = () => {
    resetForm()
    if (retailerIndex < retailers.length - 1) {
      // Next retailer, same product
      setRetailerIndex(retailerIndex + 1)
    } else if (productIndex < products.length - 1) {
      // Next product, first retailer
      setProductIndex(productIndex + 1)
      setRetailerIndex(0)
    } else {
      // All done
      toast({
        title: "All Complete!",
        description: `Saved ${savedCount} prices across all products and retailers.`,
      })
      router.push("/dashboard/prices")
    }
  }

  const goBack = () => {
    resetForm()
    if (retailerIndex > 0) {
      setRetailerIndex(retailerIndex - 1)
    } else if (productIndex > 0) {
      setProductIndex(productIndex - 1)
      setRetailerIndex(retailers.length - 1)
    }
  }

  const handleSave = async () => {
    if (!price && !isSoldOut && !isNotAvailable) {
      toast({
        title: "No data entered",
        description: "Enter a price, mark as sold out, or mark as N/A.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const priceValue = isSoldOut || isNotAvailable ? 0 : parseFloat(price)
      const origPrice = isPromo && originalPrice ? parseFloat(originalPrice) : null

      // Update existing active prices to historical
      const { error: updateError } = await supabase
        .from("prices")
        .update({ status: "historical" })
        .eq("product_id", currentProduct.id)
        .eq("retailer", currentRetailer)
        .eq("status", "active")

      if (updateError) throw updateError

      // Insert new price
      const { error: insertError } = await supabase.from("prices").insert({
        product_id: currentProduct.id,
        retailer: currentRetailer,
        price: priceValue,
        original_price: origPrice,
        is_promotion: isPromo,
        is_sold_out: isSoldOut,
        status: isNotAvailable ? "not_carried" : isSoldOut ? "out_of_stock" : "active",
        timestamp: new Date().toISOString(),
      })

      if (insertError) throw insertError

      setSavedCount((c) => c + 1)
      toast({
        title: "Saved",
        description: `${currentProduct.name} @ ${currentRetailer}`,
      })

      // Auto-advance
      advance()
    } catch (error) {
      console.error("Error saving price:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save price",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!currentProduct) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p>No products available for sequential entry.</p>
        </CardContent>
      </Card>
    )
  }

  const progressPercent = Math.round(((currentStep - 1) / totalSteps) * 100)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Progress header */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">
                Product {productIndex + 1} / {products.length}
              </Badge>
              <Badge variant="outline">
                Retailer {retailerIndex + 1} / {retailers.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Save className="h-3.5 w-3.5" />
              {savedCount} saved
            </div>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{progressPercent}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Entry card */}
      <Card className="shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>{currentProduct.name}</span>
            <Badge
              className="text-white text-xs"
              style={{ backgroundColor: RETAILER_COLORS[currentRetailer] || "#6b7280" }}
            >
              {currentRetailer}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{currentProduct.category}</p>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* URL link */}
          {currentUrl && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => window.open(currentUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open product page
            </Button>
          )}

          {/* Price input */}
          <div className="space-y-2">
            <Label>Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                ref={priceInputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="pl-7 text-lg font-mono"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isSoldOut || isNotAvailable}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && price) handleSave()
                }}
              />
            </div>
          </div>

          {/* Promo original price */}
          {isPromo && (
            <div className="space-y-2">
              <Label>Original Price (before sale)</Label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-9 font-mono"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  disabled={isSoldOut || isNotAvailable}
                />
              </div>
              {price && originalPrice && (
                <Badge variant="brand">
                  {Math.round(
                    ((parseFloat(originalPrice) - parseFloat(price)) /
                      parseFloat(originalPrice)) *
                      100
                  )}
                  % off
                </Badge>
              )}
            </div>
          )}

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border">
              <Switch
                id="promo"
                checked={isPromo}
                onCheckedChange={setIsPromo}
                disabled={isSoldOut || isNotAvailable}
              />
              <Label htmlFor="promo" className="text-xs cursor-pointer flex items-center gap-1">
                <Tag className="h-3 w-3 text-muted-foreground" />
                Sale
              </Label>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border">
              <Switch
                id="soldout"
                checked={isSoldOut}
                onCheckedChange={(checked) => {
                  setIsSoldOut(checked)
                  if (checked) {
                    setPrice("")
                    setIsPromo(false)
                    setIsNotAvailable(false)
                  }
                }}
              />
              <Label htmlFor="soldout" className="text-xs cursor-pointer flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
                Sold Out
              </Label>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg border">
              <Switch
                id="notavailable"
                checked={isNotAvailable}
                onCheckedChange={(checked) => {
                  setIsNotAvailable(checked)
                  if (checked) {
                    setPrice("")
                    setIsPromo(false)
                    setIsSoldOut(false)
                  }
                }}
              />
              <Label htmlFor="notavailable" className="text-xs cursor-pointer flex items-center gap-1">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                N/A
              </Label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={productIndex === 0 && retailerIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={advance}
              className="text-muted-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/prices")}
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || (!price && !isSoldOut && !isNotAvailable)}
            >
              <Check className="h-4 w-4 mr-1" />
              {loading ? "Saving..." : "Save"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

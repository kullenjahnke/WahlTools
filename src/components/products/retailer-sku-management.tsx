/** 
 * @deprecated This component has been replaced by RetailerAssociations
 * which provides more comprehensive retailer management including both SKUs and URLs.
 * Use RetailerAssociations instead.
 */

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createClientClient } from "@/lib/supabase/client"
import { RETAILERS } from "@/lib/config/retailers"

interface RetailerSkuManagementProps {
  productId: string
  initialSkus?: {
    retailer: string
    sku: string
  }[]
  onUpdate?: () => void
}

export function RetailerSkuManagement({ 
  productId, 
  initialSkus = [], 
  onUpdate 
}: RetailerSkuManagementProps) {
  const [skus, setSkus] = useState<Record<string, string>>(
    initialSkus.reduce((acc, { retailer, sku }) => ({
      ...acc,
      [retailer]: sku
    }), {})
  )
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClientClient()

  const handleSkuChange = (retailer: string, value: string) => {
    setSkus(prev => ({
      ...prev,
      [retailer]: value
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Delete existing SKUs
      await supabase
        .from('retailer_skus')
        .delete()
        .eq('product_id', productId)

      // Insert new SKUs
      const skusToInsert = Object.entries(skus)
        .filter(([, sku]) => sku.trim() !== '')
        .map(([retailer, sku]) => ({
          product_id: productId,
          retailer,
          sku: sku.trim()
        }))

      if (skusToInsert.length > 0) {
        const { error } = await supabase
          .from('retailer_skus')
          .insert(skusToInsert)

        if (error) throw error
      }

      toast({
        title: "Success",
        description: "Retailer SKUs updated successfully"
      })

      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error saving SKUs:', error)
      toast({
        title: "Error",
        description: "Failed to save SKUs",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retailer SKUs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {RETAILERS.map((retailer) => (
            <div key={retailer} className="grid grid-cols-2 gap-4 items-center">
              <span className="font-medium">{retailer}</span>
              <Input
                placeholder="Enter SKU"
                value={skus[retailer] || ''}
                onChange={(e) => handleSkuChange(retailer, e.target.value)}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save SKUs"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
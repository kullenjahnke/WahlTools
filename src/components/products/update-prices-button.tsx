"use client"

// src/components/products/update-prices-button.tsx
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function UpdatePricesButton() {
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  async function handleUpdatePrices() {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/prices/update', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Failed to update prices')
      }

      toast({
        title: "Success",
        description: "Price update has been initiated.",
      })
    } catch (error) {
      console.error('Error updating prices:', error)
      toast({
        title: "Error",
        description: "Failed to update prices. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Button 
      onClick={handleUpdatePrices} 
      disabled={isUpdating}
      variant="outline"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
      {isUpdating ? 'Updating...' : 'Update Prices'}
    </Button>
  )
}
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { createClientClient } from "@/lib/supabase/client"
import { Download, Upload, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Papa from 'papaparse'
import type { Product, Price } from "@/types/database"
import { RETAILERS } from "@/lib/config/retailers"

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface CSVRow {
  product_id: string
  retailer: string
  price: string
}

interface BulkPriceUpdateFormProps {
  products: ProductWithPrices[]
}

interface PriceUpdate {
  productId: string
  retailer: string
  price: number
}

export function BulkPriceUpdateForm({ products }: BulkPriceUpdateFormProps) {
  const [priceUpdates, setPriceUpdates] = useState<Record<string, PriceUpdate>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClientClient()

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  )

  const handlePriceChange = (productId: string, retailer: string, value: string) => {
    const price = parseFloat(value)
    if (isNaN(price)) return

    setPriceUpdates(prev => ({
      ...prev,
      [`${productId}-${retailer}`]: {
        productId,
        retailer,
        price
      }
    }))
  }

  const getCurrentPrice = (product: ProductWithPrices, retailer: string): number | undefined => {
    return product.prices?.find(p => p.retailer === retailer)?.price
  }

  const handleSaveUpdates = async () => {
    setIsLoading(true)
    try {
      const updates = Object.values(priceUpdates)
      
      for (const update of updates) {
        await supabase.from('prices').insert({
          product_id: update.productId,
          retailer: update.retailer,
          price: update.price,
          status: 'active'
        })
      }
      
      toast({
        title: "Success",
        description: `Updated ${updates.length} prices successfully.`
      })
      
      router.refresh()
      setPriceUpdates({})
    } catch (error) {
      console.error('Error saving updates:', error)
      toast({
        title: "Error",
        description: "Failed to save price updates.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCsv = () => {
    const csvData = products.flatMap(product => 
      RETAILERS.map(retailer => ({
        product_id: product.id,
        product_name: product.name,
        retailer,
        current_price: getCurrentPrice(product, retailer) || '',
      }))
    )

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `price-update-template-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const updates = {} as { [key: string]: PriceUpdate }
        (results.data as CSVRow[]).forEach((row) => {
          if (row.product_id && row.retailer && row.price) {
            const key = `${row.product_id}-${row.retailer}`
            updates[key] = {
              productId: row.product_id,
              retailer: row.retailer,
              price: parseFloat(row.price)
            }
          }
        })
        setPriceUpdates(updates)
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export Template
            </Button>
            <Button variant="outline" className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button 
              onClick={handleSaveUpdates} 
              disabled={isLoading || Object.keys(priceUpdates).length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Product</TableHead>
                <TableHead>Category</TableHead>
                {RETAILERS.map(retailer => (
                  <TableHead key={retailer}>{retailer}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="sticky left-0 bg-background font-medium">
                    {product.name}
                  </TableCell>
                  <TableCell>{product.category_id}</TableCell>
                  {RETAILERS.map((retailer) => {
                    const currentPrice = getCurrentPrice(product, retailer)
                    const updateKey = `${product.id}-${retailer}`
                    return (
                      <TableCell key={retailer}>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={priceUpdates[updateKey]?.price || ''}
                          onChange={(e) => handlePriceChange(product.id, retailer, e.target.value)}
                          className="w-28"
                        />
                        {currentPrice !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Current: ${currentPrice.toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={RETAILERS.length + 2} className="text-center">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
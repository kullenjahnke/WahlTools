"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Download, Upload, Save, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react"
import { RETAILERS } from "@/lib/config/retailers"
import Papa from 'papaparse'
import type { Product } from "@/types/database"

interface CSVRow {
  product_upc: string
  retailer: string
  url: string
}

interface ProductUrlManagerProps {
  products: Product[]
}


export function ProductUrlManager({ products }: ProductUrlManagerProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const { toast } = useToast()
  const supabase = createClientClient()

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.upc?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const handleUrlChange = (retailer: string, url: string) => {
    setUrls(prev => ({
      ...prev,
      [retailer]: url
    }))
  }

  const loadProductUrls = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_urls')
      .select('*')
      .eq('product_id', productId)

    if (error) {
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: "Failed to load product URLs",
        variant: "destructive"
      })
      return
    }

    const urlMap = data.reduce((acc, { retailer, url }) => ({
      ...acc,
      [retailer]: url
    }), {})

    setUrls(urlMap)
  }

  const handleProductSelect = (productId: string) => {
    setSelectedProduct(productId)
    loadProductUrls(productId)
  }

  const validateUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Delete existing URLs for this product
      await supabase
        .from('product_urls')
        .delete()
        .eq('product_id', selectedProduct)

      // Insert new URLs
      const urlsToInsert = Object.entries(urls)
        .filter(([, url]) => url && validateUrl(url))
        .map(([retailer, url]) => ({
          product_id: selectedProduct,
          retailer,
          url
        }))

      if (urlsToInsert.length > 0) {
        const { error } = await supabase
          .from('product_urls')
          .insert(urlsToInsert)

        if (error) throw error
      }

      toast({
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: "Product URLs saved successfully"
      })
    } catch (error) {
      console.error('Error saving URLs:', error)
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: "Failed to save URLs",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportUrls = async () => {
    const { data, error } = await supabase
      .from('product_urls')
      .select('*')
      .in('product_id', products.map(p => p.id))

    if (error) {
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: "Failed to export URLs",
        variant: "destructive"
      })
      return
    }

    const exportData = data.map(url => ({
      product_upc: products.find(p => p.id === url.product_id)?.upc || '',
      product_name: products.find(p => p.id === url.product_id)?.name || '',
      retailer: url.retailer,
      url: url.url
    }))

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `product-urls-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setIsLoading(true)
        try {
          const urlsToInsert = (results.data as CSVRow[])
            .filter((row) => row.product_upc && row.retailer && row.url)
            .map((row) => {
              const product = products.find(p => p.upc === row.product_upc)
              if (!product) return null
              return {
                product_id: product.id,
                retailer: row.retailer,
                url: row.url
              }
            })
            .filter(Boolean)

          if (urlsToInsert.length > 0) {
            const { error } = await supabase
              .from('product_urls')
              .insert(urlsToInsert)

            if (error) throw error

            toast({
              icon: <CheckCircle2 className="size-5 text-brand" />,
              title: "Success",
              description: `Imported ${urlsToInsert.length} URLs successfully`
            })
          }
        } catch (error) {
          console.error('Error importing URLs:', error)
          toast({
            icon: <AlertTriangle className="size-5" />,
            title: "Error",
            description: "Failed to import URLs",
            variant: "destructive"
          })
        } finally {
          setIsLoading(false)
        }
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Product URL Manager</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportUrls}>
              <Download className="mr-2 h-4 w-4" />
              Export URLs
            </Button>
            <Button variant="outline" className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <Upload className="mr-2 h-4 w-4" />
              Import URLs
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedProduct} onValueChange={handleProductSelect}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} {product.upc ? `(${product.upc})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Retailer</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RETAILERS.map(retailer => (
                      <TableRow key={retailer}>
                        <TableCell>{retailer}</TableCell>
                        <TableCell>
                          <Input
                            value={urls[retailer] || ''}
                            onChange={(e) => handleUrlChange(retailer, e.target.value)}
                            placeholder="Enter product URL"
                          />
                        </TableCell>
                        <TableCell>
                          {urls[retailer] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(urls[retailer], '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  Save URLs
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
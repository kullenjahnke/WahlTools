"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Upload, Save, FileText } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import Papa from 'papaparse'

interface ProductImport {
  name: string
  sku: string
  category: string
  aliases?: string
  status: 'pending' | 'valid' | 'invalid'
  error?: string
}

const VALID_CATEGORIES = ["Fresh Burgers", "Frozen Burgers", "Pickles", "Bacon", "Sauces", "Cheese"]

export function BulkProductImport() {
  const [products, setProducts] = useState<ProductImport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClientClient()

  const validateProduct = (product: ProductImport): ProductImport => {
    if (!product.name) {
      return { ...product, status: 'invalid', error: 'Name is required' }
    }
    if (!product.sku) {
      return { ...product, status: 'invalid', error: 'SKU is required' }
    }
    if (!product.category || !VALID_CATEGORIES.includes(product.category)) {
      return { ...product, status: 'invalid', error: 'Invalid category' }
    }
    return { ...product, status: 'valid', error: undefined }
  }

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Example Product',
        sku: 'SKU123',
        category: VALID_CATEGORIES[0],
        aliases: 'Alternate Name 1, Alternate Name 2'
      }
    ]
    
    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const importedProducts: ProductImport[] = (results.data as Record<string, string>[]).map((row: Record<string, string>) => ({
          name: row.name?.trim(),
          sku: row.sku?.trim(),
          category: row.category?.trim(),
          aliases: row.aliases?.trim(),
          status: 'pending' as const
        }))
        
        const validatedProducts = importedProducts.map(validateProduct)
        setProducts(validatedProducts)
      }
    })
  }

  const handleSave = async () => {
    setIsLoading(true)
    const validProducts = products.filter(p => p.status === 'valid')
    
    try {
      for (const product of validProducts) {
        const { error } = await supabase.from('products').insert({
          name: product.name,
          sku: product.sku,
          category: product.category,
          aliases: product.aliases ? product.aliases.split(',').map(a => a.trim()) : [],
        })
        
        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Imported ${validProducts.length} products successfully.`
      })
      
      setProducts([])
    } catch (error) {
      console.error('Error importing products:', error)
      toast({
        title: "Error",
        description: "Failed to import products. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validProductCount = products.filter(p => p.status === 'valid').length
  const hasErrors = products.some(p => p.status === 'invalid')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bulk Product Import</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <Button variant="outline" className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".csv"
                onChange={handleFileUpload}
              />
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {products.length > 0 ? (
          <>
            <div className="mb-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  Found {products.length} products, {validProductCount} valid
                  {hasErrors && ", some products have errors"}
                </AlertDescription>
              </Alert>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.aliases}</TableCell>
                      <TableCell>
                        <span className={
                          product.status === 'valid'
                            ? 'text-brand'
                            : product.status === 'invalid'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        }>
                          {product.status === 'valid' ? '✓ Valid' : product.error || 'Pending'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={isLoading || validProductCount === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Import {validProductCount} Products
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Upload a CSV file to import products
          </div>
        )}
      </CardContent>
    </Card>
  )
}
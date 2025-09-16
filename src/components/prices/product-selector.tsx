"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package } from "lucide-react"

interface Product {
  id: string
  name: string
  brand_name?: string
  brand_type?: string
}

interface ProductSelectorProps {
  products: Product[]
  selectedProductId: string
  baseUrl: string
}

export function ProductSelector({ products, selectedProductId, baseUrl }: ProductSelectorProps) {
  const router = useRouter()

  const handleProductChange = (value: string) => {
    router.push(`${baseUrl}?product=${value}`)
  }

  return (
    <div className="flex items-center gap-4">
      <Package className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <label htmlFor="product-select" className="text-sm font-medium mb-2 block">
          Select Product
        </label>
        <Select 
          value={selectedProductId}
          onValueChange={handleProductChange}
        >
          <SelectTrigger id="product-select" className="w-full">
            <SelectValue placeholder="Choose a product" />
          </SelectTrigger>
          <SelectContent>
            {/* Wahlburgers products first */}
            {products
              .filter(p => p.brand_type === 'wahlburgers')
              .map(product => (
                <SelectItem key={product.id} value={product.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">⭐ {product.name}</span>
                  </span>
                </SelectItem>
              ))
            }
            
            {/* Separator if there are competitor products */}
            {products.filter(p => p.brand_type === 'competitor').length > 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground border-t">
                Competitor Products
              </div>
            )}
            
            {/* Competitor products */}
            {products
              .filter(p => p.brand_type === 'competitor')
              .map(product => (
                <SelectItem key={product.id} value={product.id}>
                  {product.brand_name ? `${product.brand_name} - ${product.name}` : product.name}
                </SelectItem>
              ))
            }
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
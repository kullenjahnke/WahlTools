"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Package, Tag, AlignLeft, FileText, Save, Building2 } from "lucide-react"
import type { Product, ProductCategory, Brand } from "@/types/database"

interface UnifiedProductFormProps {
  product?: Product
  onSuccess?: () => void
}

export function UnifiedProductForm({ product, onSuccess }: UnifiedProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  
  // Form fields
  const [brandId, setBrandId] = useState(product?.brand_id || "")
  const [, setBrandType] = useState(product?.brand_type || "wahlburgers")
  const [name, setName] = useState(product?.name || "")
  const [categoryId, setCategoryId] = useState(product?.category_id || "")
  const [upc, setUpc] = useState(product?.upc || "")
  const [description, setDescription] = useState(product?.description || "")
  const [internalNotes, setInternalNotes] = useState(product?.internal_notes || "")
  const [aliases, setAliases] = useState(product?.aliases?.join(", ") || "")

  // Load categories and brands
  useEffect(() => {
    async function loadData() {
      // Load categories
      const { data: categoriesData } = await supabase
        .from('product_categories')
        .select('*')
        .order('name')
      
      if (categoriesData) {
        setCategories(categoriesData)
      }

      // Load brands
      const { data: brandsData } = await supabase
        .from('brands')
        .select('*')
        .order('name')
      
      if (brandsData) {
        setBrands(brandsData)
        
        // Set default Wahlburgers brand if new product
        if (!product) {
          const wahlburgersBrand = brandsData.find(b => b.name === 'Wahlburgers')
          if (wahlburgersBrand) {
            setBrandId(wahlburgersBrand.id)
          }
        }
      }
    }
    
    loadData()
  }, [supabase, product])

  // Update brand type when brand changes
  const handleBrandChange = (newBrandId: string) => {
    setBrandId(newBrandId)
    const selectedBrand = brands.find(b => b.id === newBrandId)
    if (selectedBrand) {
      setBrandType(selectedBrand.type)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !categoryId || !brandId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    
    try {
      const selectedBrand = brands.find(b => b.id === brandId)
      const productData = {
        name,
        category_id: categoryId,
        brand_id: brandId,
        brand_type: selectedBrand?.type || 'competitor',
        brand_name: selectedBrand?.name || '',
        upc: upc || null,
        description: description || null,
        internal_notes: internalNotes || null,
        aliases: aliases ? aliases.split(',').map(a => a.trim()) : null,
      }

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
        
        if (error) throw error
        
        toast({
          title: "Success",
          description: "Product updated successfully",
        })
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert([productData])
        
        if (error) throw error
        
        toast({
          title: "Success",
          description: "Product created successfully",
        })
      }
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/dashboard/products')
      }
      router.refresh()
    } catch (error) {
      console.error('Error saving product:', error)
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product ? 'Edit Product' : 'Add New Product'}
          </CardTitle>
          <CardDescription>
            {product ? 'Update product information' : 'Create a new product in the system'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Selection */}
          <div className="space-y-2">
            <Label htmlFor="brand" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Brand *
            </Label>
            <Select value={brandId} onValueChange={handleBrandChange}>
              <SelectTrigger id="brand">
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {/* Wahlburgers first */}
                {brands
                  .filter(b => b.type === 'wahlburgers')
                  .map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <span className="font-semibold">⭐ {brand.name}</span>
                    </SelectItem>
                  ))
                }
                {/* Separator - just visual, not selectable */}
                {brands.filter(b => b.type === 'competitor').length > 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground border-t">
                    Competitor Brands
                  </div>
                )}
                {/* Then competitors */}
                {brands
                  .filter(b => b.type === 'competitor')
                  .map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Product Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Category *
            </Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* UPC */}
          <div className="space-y-2">
            <Label htmlFor="upc">UPC/Barcode</Label>
            <Input
              id="upc"
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
              placeholder="Enter UPC code (optional)"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2">
              <AlignLeft className="h-4 w-4" />
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter product description (optional)"
              rows={3}
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Internal Notes
            </Label>
            <Textarea
              id="notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal notes (not visible to customers)"
              rows={3}
            />
          </div>

          {/* Aliases */}
          <div className="space-y-2">
            <Label htmlFor="aliases">
              Product Aliases
            </Label>
            <Input
              id="aliases"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Alternative names (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Enter alternative names or variations, separated by commas
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/products')}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
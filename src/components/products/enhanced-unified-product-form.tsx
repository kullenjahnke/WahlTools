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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { 
  Plus, 
  Package, 
  Tag, 
  AlignLeft, 
  FileText, 
  Save, 
  Building2, 
  Upload, 
  X, 
  Image as ImageIcon,
  Link2,
  Trash2
} from "lucide-react"
import Image from "next/image"
import type { Product, ProductCategory, Brand } from "@/types/database"
import { RETAILERS } from "@/lib/config/retailers"

interface UnifiedProductFormProps {
  product?: Product
  onSuccess?: () => void
}

export function EnhancedUnifiedProductForm({ product, onSuccess }: UnifiedProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  
  // Form fields
  const [brandId, setBrandId] = useState(product?.brand_id || "")
  const [brandType, setBrandType] = useState(product?.brand_type || "wahlburgers")
  const [name, setName] = useState(product?.name || "")
  const [categoryId, setCategoryId] = useState(product?.category_id || "")
  const [upc, setUpc] = useState(product?.upc || "")
  const [description, setDescription] = useState(product?.description || "")
  const [internalNotes, setInternalNotes] = useState(product?.internal_notes || "")
  const [aliases, setAliases] = useState(product?.aliases?.join(", ") || "")
  
  // Image handling
  const [images, setImages] = useState<Array<{
    id?: string
    url: string
    file?: File
    type: string
    main: boolean
  }>>([])
  
  // Retailer URLs
  const [retailerUrls, setRetailerUrls] = useState<Array<{
    retailer: string
    url: string
  }>>([])

  // Load categories, brands, and existing data
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
      
      // Load existing product images if editing
      if (product) {
        const { data: imagesData } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', product.id)
        
        if (imagesData) {
          setImages(imagesData.map(img => ({
            id: img.id,
            url: img.url,
            type: img.type || 'product',
            main: img.main || false
          })))
        }
        
        // Load existing retailer URLs
        const { data: urlsData } = await supabase
          .from('product_urls')
          .select('*')
          .eq('product_id', product.id)
        
        if (urlsData) {
          setRetailerUrls(urlsData.map(url => ({
            retailer: url.retailer,
            url: url.url
          })))
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

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    
    try {
      for (const file of Array.from(files)) {
        // Create a preview URL
        const previewUrl = URL.createObjectURL(file)
        
        // Add to images array with file reference
        setImages(prev => [...prev, {
          url: previewUrl,
          file: file,
          type: 'product',
          main: prev.length === 0 // First image is main by default
        }])
      }
    } catch (error) {
      console.error('Error handling image upload:', error)
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      })
    } finally {
      setUploadingImage(false)
    }
  }

  // Upload image to Supabase storage
  const uploadImageToStorage = async (file: File, productId: string) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${productId}-${Date.now()}.${fileExt}`
    const filePath = `products/${fileName}`

    const { error: uploadError, data } = await supabase.storage
      .from('product-images')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    return publicUrl
  }

  // Remove image
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  // Set main image
  const setMainImage = (index: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      main: i === index
    })))
  }

  // Add retailer URL
  const addRetailerUrl = () => {
    setRetailerUrls(prev => [...prev, { retailer: '', url: '' }])
  }

  // Update retailer URL
  const updateRetailerUrl = (index: number, field: 'retailer' | 'url', value: string) => {
    setRetailerUrls(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  // Remove retailer URL
  const removeRetailerUrl = (index: number) => {
    setRetailerUrls(prev => prev.filter((_, i) => i !== index))
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

      let productId = product?.id

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
        
        if (error) throw error
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single()
        
        if (error) throw error
        productId = data.id
      }

      if (productId) {
        // Handle image uploads
        for (const image of images) {
          if (image.file) {
            // Upload new image
            const publicUrl = await uploadImageToStorage(image.file, productId)
            
            const { error } = await supabase
              .from('product_images')
              .insert({
                product_id: productId,
                url: publicUrl,
                type: image.type,
                main: image.main
              })
            
            if (error) throw error
          } else if (image.id) {
            // Update existing image
            const { error } = await supabase
              .from('product_images')
              .update({
                main: image.main,
                type: image.type
              })
              .eq('id', image.id)
            
            if (error) throw error
          }
        }

        // Handle retailer URLs
        // First, delete existing URLs if updating
        if (product) {
          await supabase
            .from('product_urls')
            .delete()
            .eq('product_id', productId)
        }

        // Insert new URLs
        const validUrls = retailerUrls.filter(item => item.retailer && item.url)
        if (validUrls.length > 0) {
          const { error } = await supabase
            .from('product_urls')
            .insert(
              validUrls.map(item => ({
                product_id: productId,
                retailer: item.retailer,
                url: item.url,
                is_active: true
              }))
            )
          
          if (error) throw error
        }
      }
      
      toast({
        title: "Success",
        description: product ? "Product updated successfully" : "Product created successfully",
      })
      
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
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="retailers">Retailer Links</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Information
              </CardTitle>
              <CardDescription>
                Basic product details and categorization
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
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Product Images
              </CardTitle>
              <CardDescription>
                Upload product images (first image will be the main image)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={uploadingImage}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingImage ? 'Uploading...' : 'Upload Images'}
                </Button>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                        <Image
                          src={image.url}
                          alt={`Product image ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        {image.main && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                            Main
                          </div>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!image.main && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setMainImage(index)}
                          >
                            Set Main
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="retailers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Retailer Product Links
              </CardTitle>
              <CardDescription>
                Add links to this product on retailer websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {retailerUrls.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={item.retailer}
                    onValueChange={(value) => updateRetailerUrl(index, 'retailer', value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select retailer" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETAILERS.map(retailer => (
                        <SelectItem key={retailer} value={retailer}>
                          {retailer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Product URL"
                    value={item.url}
                    onChange={(e) => updateRetailerUrl(index, 'url', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRetailerUrl(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addRetailerUrl}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Retailer Link
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
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
    </form>
  )
}
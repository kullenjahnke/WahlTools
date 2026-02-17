"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { 
  Download, 
  Plus, 
  Search, 
  Trash2, 
  Grid, 
  List,
  Package2,
  Edit2
} from "lucide-react"
import { format } from "date-fns"
import Papa from 'papaparse'
import Image from "next/image"
import { CardContent } from "@/components/ui/card"

interface Category {
  id: string
  name: string
}

interface Brand {
  id: string
  name: string
  type: string
}

interface Product {
  id: string;
  name: string;
  category_id: string;
  brand_id?: string | null;
  brand_type?: string;
  brand_name?: string;
  description: string | null;
  internal_notes: string | null;
  aliases: string[] | null;
  created_at: string;
  updated_at: string;
  prices?: {
    id: string;
    retailer: string;
    price: number;
    timestamp: string;
    status: string;
  }[];
  product_images?: {
    url: string;
    main: boolean;
  }[];
}

interface EnhancedProductsListProps {
  products?: Product[];
  categories: Category[];
  brands?: Brand[];
}

export function EnhancedProductsList({ 
  products: initialProducts = [], 
  categories,
  brands = []
}: EnhancedProductsListProps) {
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [sortConfig] = useState<{
    key: keyof Product
    direction: 'asc' | 'desc'
  }>({
    key: 'name',
    direction: 'asc'
  })

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  if (!initialProducts || initialProducts.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No products available.
      </div>
    )
  }

  // Removed unused handleSort function 
  // const handleSort = (key: keyof Product) => {
  //   setSortConfig(current => ({
  //     key,
  //     direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
  //   }))
  // }

  const filteredProducts = initialProducts
    .filter(product => {
      const searchLower = search.toLowerCase()
      const searchMatch = search === "" || [
        product.name,
        product.description || "",
        product.internal_notes || "",
        ...(product.aliases || [])
      ].some(field => 
        field.toLowerCase().includes(searchLower)
      );

      const categoryMatch = 
        categoryFilter === "all" || 
        product.category_id === categoryFilter;

      const brandMatch = 
        brandFilter === "all" || 
        product.brand_id === brandFilter ||
        (brandFilter === "wahlburgers" && product.brand_type === "wahlburgers") ||
        (brandFilter === "competitors" && product.brand_type === "competitor");

      return searchMatch && categoryMatch && brandMatch;
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        const aString = aValue.join(',')
        const bString = bValue.join(',')
        return sortConfig.direction === 'asc'
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString)
      }

      if (sortConfig.key === 'created_at') {
        const aDate = aValue ? new Date(aValue as string).getTime() : 0
        const bDate = bValue ? new Date(bValue as string).getTime() : 0
        return sortConfig.direction === 'asc'
          ? aDate - bDate
          : bDate - aDate
      }

      const aString = String(aValue || '')
      const bString = String(bValue || '')
      return sortConfig.direction === 'asc'
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString)
    })

  const handleSelectAll = (checked: boolean) => {
    setSelectedProducts(checked ? filteredProducts.map(p => p.id) : [])
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProducts(current => 
      checked 
        ? [...current, productId]
        : current.filter(id => id !== productId)
    )
  }

  const handleBulkDelete = async () => {
    if (!selectedProducts.length) return

    const confirmed = window.confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedProducts)

      if (error) throw error

      toast({
        title: "Success",
        description: `Deleted ${selectedProducts.length} products`
      })

      setSelectedProducts([])
      router.refresh()
    } catch (error) {
      console.error('Error deleting products:', error)
      toast({
        title: "Error", 
        description: "Failed to delete products",
        variant: "destructive"
      })
    }
  }

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    if (!selectedProducts.length) return

    try {
      const { error } = await supabase
        .from('products')
        .update({ status })
        .in('id', selectedProducts)

      if (error) throw error

      toast({
        title: "Success",
        description: `Updated status for ${selectedProducts.length} products`
      })

      setSelectedProducts([])
      router.refresh()
    } catch (error) {
      console.error('Error updating products:', error)
      toast({
        title: "Error",
        description: "Failed to update products",
        variant: "destructive"
      })
    }
  }

  const exportProducts = () => {
    const data = filteredProducts.map(product => ({
      Name: product.name,
      Category: categories.find(c => c.id === product.category_id)?.name || '',
      Description: product.description || '',
      Aliases: product.aliases?.join(', ') || '',
      'Internal Notes': product.internal_notes || '',
      'Created At': format(new Date(product.created_at), 'PP'),
      'Updated At': format(new Date(product.updated_at), 'PP')
    }))

    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const handleDelete = async (productId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this product?")
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Product deleted successfully"
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      })
    }
  }

  const renderListView = () => (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox 
                checked={selectedProducts.length === filteredProducts.length}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="min-w-[250px]">Product</TableHead>
            <TableHead className="min-w-[120px]">Brand</TableHead>
            <TableHead className="min-w-[150px]">Category</TableHead>
            <TableHead className="min-w-[120px]">Created</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((product) => {
            const mainImage = product.product_images?.find(img => img.main)

            return (
              <TableRow 
                key={product.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/dashboard/products/${product.id}/view`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedProducts.includes(product.id)}
                    onCheckedChange={(checked) => handleSelectProduct(product.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted">
                      {mainImage ? (
                        <Image
                          src={mainImage.url}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.brand_type === 'wahlburgers' && (
                        <span className="text-xs font-semibold text-yellow-600">⭐ Wahlburgers</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={product.brand_type === 'wahlburgers' ? 'font-semibold' : ''}>
                    {product.brand_name || '-'}
                  </span>
                </TableCell>
                <TableCell>
                  {categories.find(c => c.id === product.category_id)?.name}
                </TableCell>
                <TableCell suppressHydrationWarning>{format(new Date(product.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/products/${product.id}`)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredProducts.map((product) => {
        const mainImage = product.product_images?.find(img => img.main)
        
        return (
          <Card 
            key={product.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/dashboard/products/${product.id}/view`)}
          >
            <div className="aspect-square relative bg-muted">
              {mainImage ? (
                <Image
                  src={mainImage.url}
                  alt={product.name}
                  fill
                  className="object-cover rounded-t-lg"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package2 className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div>
                  <h3 className="font-medium line-clamp-1">{product.name}</h3>
                  {product.brand_type === 'wahlburgers' && (
                    <span className="text-xs font-semibold text-yellow-600">⭐ Wahlburgers</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description || 'No description'}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground" suppressHydrationWarning>
                    {format(new Date(product.created_at), 'MMM d, yyyy')}
                  </span>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/products/${product.id}`)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-4 flex-wrap">
          <div className="relative w-full md:w-[350px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              <SelectItem value="wahlburgers">⭐ Wahlburgers</SelectItem>
              <SelectItem value="competitors">Competitors</SelectItem>
              {brands.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-t">
                    Individual Brands
                  </div>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(current => current === 'list' ? 'grid' : 'list')}
          >
            {view === 'list' ? (
              <Grid className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportProducts}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button 
            size="sm"
            onClick={() => router.push('/dashboard/products/new')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {selectedProducts.length > 0 && (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <span className="text-sm">
            {selectedProducts.length} product{selectedProducts.length === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusUpdate('active')}
            >
              Set Active
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusUpdate('inactive')}
            >
              Set Inactive
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden border rounded-lg w-full">
        {view === 'list' ? renderListView() : renderGridView()}
      </Card>

      {filteredProducts.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No products found.
        </div>
      )}
    </div>
  )
}
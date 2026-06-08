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
  Search,
  Trash2,
  Grid,
  List,
  Package2,
  Edit2,
  Filter,
  Tag,
  CheckCircle2,
  AlertTriangle
} from "lucide-react"
import { format } from "date-fns"
import Papa from 'papaparse'
import Image from "next/image"
import { CardContent } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { RowActions } from "@/components/ui/row-actions"
import { BRANDS, productMatchesBrand } from "@/lib/config/brands"

interface Category {
  id: string
  name: string
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
}

export function EnhancedProductsList({
  products: initialProducts = [],
  categories,
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

  // Only surface categories that actually have products as filter options.
  const usedCategoryIds = new Set(initialProducts.map((p) => p.category_id))
  const categoryOptions = categories.filter((c) => usedCategoryIds.has(c.id))

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
        brandFilter === "all" || productMatchesBrand(product, brandFilter);

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
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: `Deleted ${selectedProducts.length} products`
      })

      setSelectedProducts([])
      router.refresh()
    } catch (error) {
      console.error('Error deleting products:', error)
      toast({
        icon: <AlertTriangle className="size-5" />,
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
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: `Updated status for ${selectedProducts.length} products`
      })

      setSelectedProducts([])
      router.refresh()
    } catch (error) {
      console.error('Error updating products:', error)
      toast({
        icon: <AlertTriangle className="size-5" />,
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
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: "Product deleted successfully"
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast({
        icon: <AlertTriangle className="size-5" />,
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
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.map((product) => {
            const mainImage = product.product_images?.find(img => img.main)
            const categoryName = categories.find(c => c.id === product.category_id)?.name
            const isWahlburgers = product.brand_type === 'wahlburgers'

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
                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
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
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {product.brand_name ? (
                    <Chip
                      label={product.brand_name}
                      size="lg"
                      tone={isWahlburgers ? "brand" : "auto"}
                      colorKey={product.brand_name}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {categoryName ? (
                    <Chip label={categoryName} size="lg" colorKey={product.category_id} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground" suppressHydrationWarning>
                  {format(new Date(product.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <RowActions
                    label={`Actions for ${product.name}`}
                    actions={[
                      {
                        label: "Edit",
                        icon: <Edit2 className="size-4" />,
                        href: `/dashboard/products/${product.id}`,
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 className="size-4" />,
                        destructive: true,
                        separatorBefore: true,
                        onSelect: () => handleDelete(product.id),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredProducts.map((product) => {
        const mainImage = product.product_images?.find(img => img.main)
        const categoryName = categories.find(c => c.id === product.category_id)?.name
        const isWahlburgers = product.brand_type === 'wahlburgers'

        return (
          <Card
            key={product.id}
            className="group relative cursor-pointer overflow-hidden border-border/70 transition-all hover:border-border hover:shadow-md"
            onClick={() => router.push(`/dashboard/products/${product.id}/view`)}
          >
            <div className="aspect-square relative bg-muted">
              {mainImage ? (
                <Image
                  src={mainImage.url}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package2 className="h-12 w-12 text-muted-foreground/60" />
                </div>
              )}
              <div
                className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <RowActions
                  label={`Actions for ${product.name}`}
                  className="size-8 bg-background/80 backdrop-blur hover:bg-background"
                  actions={[
                    {
                      label: "Edit",
                      icon: <Edit2 className="size-4" />,
                      href: `/dashboard/products/${product.id}`,
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-4" />,
                      destructive: true,
                      separatorBefore: true,
                      onSelect: () => handleDelete(product.id),
                    },
                  ]}
                />
              </div>
            </div>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-medium leading-snug line-clamp-1">{product.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {product.brand_name && (
                  <Chip
                    label={product.brand_name}
                    size="sm"
                    tone={isWahlburgers ? "brand" : "auto"}
                    colorKey={product.brand_name}
                  />
                )}
                {categoryName && (
                  <Chip label={categoryName} size="sm" colorKey={product.category_id} />
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                {product.description || 'No description'}
              </p>
              <div className="flex items-center border-t border-border/60 pt-3">
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  Added {format(new Date(product.created_at), 'MMM d, yyyy')}
                </span>
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
          <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[150px] border-none bg-transparent shadow-none">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {BRANDS.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] border-none bg-transparent shadow-none">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {view === 'list' ? (
        <Card className="overflow-hidden border rounded-lg w-full">
          {renderListView()}
        </Card>
      ) : (
        renderGridView()
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No products found.
        </div>
      )}
    </div>
  )
}
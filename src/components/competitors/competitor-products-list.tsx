// src/components/competitors/competitor-products-list.tsx
"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Search, Edit, Trash2, Tag, Filter, Eye } from "lucide-react"
import { CompetitorProduct, Competitor } from "@/types/database"

interface CompetitorProductsListProps {
  competitorProducts: (CompetitorProduct & {
    competitor: Competitor;
    related_product?: {
      id: string;
      name: string;
      category_id: string;
    } | null;
  })[];
  categories: {
    id: string;
    name: string;
  }[];
  competitors: {
    id: string;
    name: string;
  }[];
}

export function CompetitorProductsList({ 
  competitorProducts, 
  categories,
  competitors 
}: CompetitorProductsListProps) {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [competitorFilter, setCompetitorFilter] = useState<string>("all")
  
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  // Create a map of category IDs to names
  const categoryMap = new Map(
    categories.map(category => [category.id, category.name])
  )

  const filteredProducts = competitorProducts.filter(product => {
    const searchMatch = search.trim() === "" || 
      product.name.toLowerCase().includes(search.toLowerCase());
    
    const categoryMatch = 
      categoryFilter === "all" || 
      product.category_id === categoryFilter;
    
    const competitorMatch = 
      competitorFilter === "all" || 
      product.competitor_id === competitorFilter;
    
    return searchMatch && categoryMatch && competitorMatch;
  });

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${name}?`)
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('competitor_products')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Success",
        description: `${name} has been deleted`
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting competitor product:', error)
      toast({
        title: "Error",
        description: "Failed to delete competitor product",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-full md:w-[350px]"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
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

          <div className="flex items-center gap-1">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Select value={competitorFilter} onValueChange={setCompetitorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Competitor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competitors</SelectItem>
                {competitors.map((competitor) => (
                  <SelectItem key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Competitor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Related Wahlburgers Product</TableHead>
                <TableHead className="text-right">Weight (oz)</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.competitor?.name}</TableCell>
                  <TableCell>{product.category_id ? categoryMap.get(product.category_id) || 'Unknown' : 'Unknown'}</TableCell>
                  <TableCell>
                    {product.related_product ? product.related_product.name : 'Not linked'}
                  </TableCell>
                  <TableCell className="text-right">{product.weight_oz || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/competitors/products/${product.id}/view`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/competitors/products/${product.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id, product.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-muted-foreground">No competitor products found</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => router.push('/dashboard/competitors/products/new')}
                    >
                      Add your first competitor product
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
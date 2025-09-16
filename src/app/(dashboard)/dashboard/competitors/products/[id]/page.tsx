// src/app/(dashboard)/dashboard/competitors/products/[id]/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CompetitorProductForm } from "@/components/competitors/competitor-product-form"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Eye } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditCompetitorProductPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  
  // Fetch the competitor product
  const { data: competitorProduct, error } = await supabase
    .from('competitor_products')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !competitorProduct) {
    notFound()
  }
  
  // Fetch competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name')
    .order('name')
  
  // Fetch categories
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name')
  
  // Fetch Wahlburgers products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category_id')
    .order('name')
  
  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/competitors/products">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Competitor Products
          </Link>
        </Button>
        
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/dashboard/competitors/products/${id}/view`}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Edit Competitor Product</h1>
          <p className="text-muted-foreground">
            Update competitor product information
          </p>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <CompetitorProductForm 
            initialData={competitorProduct}
            competitors={competitors || []}
            categories={categories || []}
            products={products || []}
          />
        </div>
      </div>
    </div>
  )
}
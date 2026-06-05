import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { EnhancedProductsList } from "@/components/products/enhanced-products-list"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Products" }

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient()
  
  try {
    const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id,
          name,
          category_id,
          brand_id,
          brand_type,
          brand_name,
          description,
          internal_notes,
          aliases,
          created_at,
          updated_at,
          product_images (
            id,
            url,
            type,
            main
          )
        `)
        .order('name')
        .limit(500),
      supabase
        .from('product_categories')
        .select('*')
        .order('name')
        .limit(100),
      supabase
        .from('brands')
        .select('*')
        .order('name')
        .limit(100)
    ])

    if (productsResponse.error) {
      console.error('Error fetching products:', {
        message: productsResponse.error.message,
        details: productsResponse.error.details,
        hint: productsResponse.error.hint,
        code: productsResponse.error.code
      })
      throw productsResponse.error
    }

    if (categoriesResponse.error) {
      console.error('Error fetching categories:', {
        message: categoriesResponse.error.message,
        details: categoriesResponse.error.details,
        hint: categoriesResponse.error.hint,
        code: categoriesResponse.error.code
      })
      throw categoriesResponse.error
    }

    if (brandsResponse.error) {
      console.error('Error fetching brands:', brandsResponse.error)
      throw brandsResponse.error
    }

    const products = productsResponse.data || []

    return (
      <PageContainer>
        <PageHeader
          title="Products"
          actions={
            <>
              <IconButton
                label="Import products"
                href="/dashboard/products/import"
                icon={<Upload className="size-4" />}
                variant="outline"
              />
              <Button asChild>
                <Link href="/dashboard/products/new">
                  <Plus className="size-4" />
                  Add product
                </Link>
              </Button>
            </>
          }
        />
        <EnhancedProductsList
          products={products}
          categories={categoriesResponse.data || []}
          brands={brandsResponse.data || []}
        />
      </PageContainer>
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in ProductsPage:', error)
    
    return (
      <PageContainer>
        <PageHeader title="Products" />
        <Card className="p-6">
          <div className="text-destructive">
            {errorMessage || 'Error loading products. Please try refreshing the page.'}
          </div>
        </Card>
      </PageContainer>
    )
  }
}
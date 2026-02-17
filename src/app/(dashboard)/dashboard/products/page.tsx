import { createSupabaseServerClient } from "@/lib/supabase/server"
import { EnhancedProductsList } from "@/components/products/enhanced-products-list"
import { Card } from "@/components/ui/card"

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

    return (
      <div className="container space-y-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <EnhancedProductsList 
          products={productsResponse.data || []} 
          categories={categoriesResponse.data || []}
          brands={brandsResponse.data || []}
        />
      </div>
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in ProductsPage:', error)
    
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Products</h1>
        <Card className="p-6 mt-6">
          <div className="text-red-500">
            {errorMessage || 'Error loading products. Please try refreshing the page.'}
          </div>
        </Card>
      </div>
    )
  }
}
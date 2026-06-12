import { createSupabaseServerClient } from "@/lib/supabase/server"
import { EnhancedUnifiedProductForm } from "@/components/products/enhanced-unified-product-form"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export const metadata = { title: "Edit Product" }

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params
  
  // Validate the ID parameter
  if (!id || typeof id !== 'string') {
    notFound()
  }
  const supabase = await createSupabaseServerClient()
  
  // Get authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }
  
  // Fetch product with all related data
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`
      *,
      product_images (
        id,
        url,
        type,
        main
      )
    `)
    .eq('id', id)
    .single()

  if (productError || !product) {
    console.error('Error fetching product:', productError)
    notFound()
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Product"
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: product.name },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/products/${id}/view`}>View details</Link>
          </Button>
        }
      />
      <div className="max-w-4xl">
        <EnhancedUnifiedProductForm product={product} />
      </div>
    </PageContainer>
  )
}
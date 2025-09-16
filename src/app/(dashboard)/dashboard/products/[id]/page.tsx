import { createSupabaseServerClient } from "@/lib/supabase/server"
import { EnhancedUnifiedProductForm } from "@/components/products/enhanced-unified-product-form"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/products">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/dashboard/products/${id}/view`}>
            View Details
          </Link>
        </Button>
      </div>

      <div className="space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-muted-foreground mt-2">
            Update product information and manage images
          </p>
        </div>

        <EnhancedUnifiedProductForm product={product} />
      </div>
    </div>
  )
}
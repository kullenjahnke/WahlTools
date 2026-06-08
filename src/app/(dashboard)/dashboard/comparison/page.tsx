import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductHeadToHead } from "@/components/comparison/product-head-to-head"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import Link from "next/link"
import { Package } from "lucide-react"

export const metadata = { title: "Comparison" }

export default async function ComparisonPage() {
  const supabase = await createSupabaseServerClient()

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand_id,
      brand_name,
      brand_type,
      category_id,
      product_images ( url, main )
    `)
    .order('brand_type')
    .order('name')

  const { data: prices, error: pricesError } = await supabase
    .from('prices')
    .select(`
      id,
      product_id,
      retailer,
      price,
      original_price,
      on_sale,
      discount_percentage,
      status,
      is_promotion,
      is_sold_out,
      timestamp
    `)
    .order('timestamp', { ascending: false })

  const { data: categories, error: categoriesError } = await supabase
    .from('product_categories')
    .select('id, name')
    .order('name')

  if (productsError || pricesError || categoriesError) {
    console.error('Error fetching data:', { productsError, pricesError, categoriesError })
    return (
      <PageContainer>
        <PageHeader title="Comparison" />
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-medium mb-2">Error Loading Comparison Data</h3>
            <p className="text-muted-foreground mb-4">Unable to load products and prices for comparison.</p>
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  if (!products || products.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Comparison" />
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Products Available</h3>
            <p className="text-muted-foreground mb-4">Add products to start comparing prices across retailers.</p>
            <Button asChild>
              <Link href="/dashboard/products/new">Add Your First Product</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="lg:flex lg:h-full lg:flex-col">
      <PageHeader title="Comparison" />
      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <ProductHeadToHead
          products={products}
          prices={prices || []}
          categories={categories || []}
        />
      </div>
    </PageContainer>
  )
}

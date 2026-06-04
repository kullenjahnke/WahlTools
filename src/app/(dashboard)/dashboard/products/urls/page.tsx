import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductUrlManager } from "@/components/products/product-url-manager"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export const metadata = { title: "Product URLs" }

export default async function ProductUrlsPage() {
  const supabase = await createSupabaseServerClient()
  
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('name')

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/products">
              <ChevronLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-bold">Product URLs</h1>
          <p className="text-muted-foreground">
            Manage product URLs for each retailer to make price checking easier.
          </p>
        </div>

        <ProductUrlManager products={products || []} />
      </div>
    </div>
  )
}
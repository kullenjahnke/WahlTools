import { createSupabaseServerClient } from "@/lib/supabase/server"
import { SequentialPriceEntry } from "@/components/prices/sequential-price-entry"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { ProductUrl } from "@/types/database"

export const metadata = { title: "Sequential Entry" }

export default async function SequentialEntryPage() {
  const supabase = await createSupabaseServerClient()

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_urls (*)")
      .order("name"),
    supabase
      .from("product_categories")
      .select("id, name"),
  ])

  if (productsResult.error) {
    return (
      <div className="container mx-auto py-6">
        <div className="p-6 bg-red-50 text-red-600 rounded-lg">
          <p>Error loading products: {productsResult.error.message}</p>
        </div>
      </div>
    )
  }

  const categoryMap = new Map(
    categoriesResult.data?.map((cat) => [cat.id, cat.name]) || []
  )

  const products = (productsResult.data || []).map((product) => ({
    id: product.id,
    name: product.name,
    category: categoryMap.get(product.category_id) || "Uncategorized",
    urls: (product.product_urls || []).map((u: ProductUrl) => ({
      retailer: u.retailer,
      url: u.url,
    })),
  }))

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/prices">
            <ChevronLeft className="h-4 w-4" />
            Back to Prices
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Sequential Price Entry</h1>
        <p className="text-muted-foreground">
          Enter prices one at a time — auto-advances through retailers, then products.
        </p>
      </div>

      <SequentialPriceEntry products={products} />
    </div>
  )
}

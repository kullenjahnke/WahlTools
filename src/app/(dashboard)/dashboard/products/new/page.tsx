import { EnhancedUnifiedProductForm } from "@/components/products/enhanced-unified-product-form"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export const metadata = { title: "New Product" }

export default function NewProductPage() {
  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/products">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">New Product</h1>
          <p className="text-muted-foreground">
            Create a new product in the catalog
          </p>
        </div>

        <EnhancedUnifiedProductForm />
      </div>
    </div>
  )
}
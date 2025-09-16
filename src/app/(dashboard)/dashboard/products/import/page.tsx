import { Metadata } from "next"
import { BulkProductImport } from "@/components/products/bulk-product-import"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Import Products",
  description: "Import products in bulk using CSV",
}

export default function ProductImportPage() {
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
          <h1 className="text-3xl font-bold">Import Products</h1>
          <p className="text-muted-foreground">
            Import your products using a CSV file. Download the template to see the required format.
          </p>
        </div>

        <div className="grid gap-8">
          <BulkProductImport />
        </div>
      </div>
    </div>
  )
}
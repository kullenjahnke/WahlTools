import { Metadata } from "next"
import { BulkProductImport } from "@/components/products/bulk-product-import"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = {
  title: "WahlTools | Import Products",
  description: "Import products in bulk using CSV",
}

export default function ProductImportPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Import Products"
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: "Import" },
        ]}
      />
      <BulkProductImport />
    </PageContainer>
  )
}

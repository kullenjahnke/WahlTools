import { EnhancedUnifiedProductForm } from "@/components/products/enhanced-unified-product-form"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | New Product" }

export default function NewProductPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New Product"
        breadcrumbs={[
          { label: "Products", href: "/dashboard/products" },
          { label: "New product" },
        ]}
      />
      <div className="max-w-4xl">
        <EnhancedUnifiedProductForm />
      </div>
    </PageContainer>
  )
}

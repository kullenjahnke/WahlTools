import { redirect } from "next/navigation"

// Competitor products are now managed through the unified products page
export default function CompetitorProductsPage() {
  redirect('/dashboard/products')
}
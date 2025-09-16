import { redirect } from "next/navigation"

// Competitor products are now added through the unified products page
export default function NewCompetitorProductPage() {
  redirect('/dashboard/products/new')
}
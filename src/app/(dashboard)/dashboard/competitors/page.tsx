import { redirect } from "next/navigation"

// Competitors are now managed through brands in the unified products system
export default function CompetitorsPage() {
  redirect('/dashboard/products')
}
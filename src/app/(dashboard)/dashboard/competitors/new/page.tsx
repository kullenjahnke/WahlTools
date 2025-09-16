// src/app/(dashboard)/dashboard/competitors/new/page.tsx
import { redirect } from "next/navigation"

// Redirect to unified product form - competitors are now managed through the main products page
export default function NewCompetitorPage() {
  redirect('/dashboard/products/new')
}
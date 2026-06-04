// src/app/(dashboard)/dashboard/competitors/[id]/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CompetitorForm } from "@/components/competitors/competitor-form"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export const metadata = { title: "Competitor" }

export default async function EditCompetitorPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  
  const { data: competitor, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error || !competitor) {
    notFound()
  }
  
  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/competitors">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Competitors
          </Link>
        </Button>
      </div>

      <div className="grid gap-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Edit Competitor</h1>
          <p className="text-muted-foreground">
            Update competitor information
          </p>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <CompetitorForm initialData={competitor} />
        </div>
      </div>
    </div>
  )
}
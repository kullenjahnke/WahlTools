import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

// Dashboard routes are auth-gated and always read cookies, so they can never
// be statically prerendered. Opting into dynamic rendering avoids Next.js
// attempting (and bailing out of) static generation at build time.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createSupabaseServerClient()

    // Use getUser instead of getSession for better cookie handling
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Error getting user:', userError)
      redirect('/login')
    }

    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar email={user.email} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    )
  } catch (error) {
    // redirect()/notFound() and dynamic-rendering bail-outs work by throwing
    // a signal that carries a `digest`. Re-throw those so Next.js can handle
    // them as intended instead of treating them as real errors.
    if (error && typeof error === "object" && "digest" in error) {
      throw error
    }
    console.error('Error in DashboardLayout:', error)
    redirect('/login')
  }
}

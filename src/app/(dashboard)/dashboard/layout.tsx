import { MainNav } from "@/components/layout/main-nav"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WahltoolsLogo } from "@/components/icons/wahltools-logo"

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
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-6">
              <MobileNav />
              <WahltoolsLogo className="h-8 w-auto" />
            </div>
            <MainNav className="mx-6 hidden md:flex" />
            <div className="flex-1 flex justify-end items-center gap-4">
              <span className="hidden sm:inline-block text-sm text-muted-foreground">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="flex-1 container py-6">
          {children}
        </main>
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
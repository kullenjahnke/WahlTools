import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh the session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Auth condition
  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  // API routes and the auth callback authenticate themselves (CRON_SECRET for
  // the cron endpoint, the registration whitelist for check-whitelist, the
  // OAuth handshake for /auth/callback) and must NOT be bounced to /login by
  // the session guard — otherwise e.g. Vercel Cron gets a 307 and never runs.
  const isSelfAuthedRoute = pathname.startsWith('/api') || pathname.startsWith('/auth')

  if (!user && !isAuthPage && !isSelfAuthedRoute) {
    // Redirect to login if accessing protected page without session
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthPage) {
    // Redirect to dashboard if accessing auth page with session
    const redirectUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - any static asset by extension (favicons, manifest, logos, etc.)
     *   so they are publicly reachable without auth — notably email-logo.png,
     *   which email clients fetch with no session.
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
}
import { createClient } from "@supabase/supabase-js"

// Service-role client for trusted server contexts (cron handlers, settings
// reads/writes). Bypasses RLS, so never expose it to the browser.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

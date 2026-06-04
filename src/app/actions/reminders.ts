"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"

// Sends a [Test] reminder to the currently signed-in user only.
export async function sendTestPriceReminder(): Promise<{
  ok: boolean
  message: string
}> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, message: "You must be signed in to send a test." }
  }

  try {
    await sendPriceReminder({ to: [user.email], test: true })
    return { ok: true, message: `Test reminder sent to ${user.email}` }
  } catch (error) {
    console.error("test reminder failed:", error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to send test.",
    }
  }
}

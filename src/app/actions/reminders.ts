"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"
import {
  DEFAULT_REMINDER_SETTINGS,
  normalizeSettings,
  type ReminderSettings,
} from "@/lib/email/settings"

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

// Reads the singleton reminder settings (falls back to defaults).
export async function getReminderSettings(): Promise<ReminderSettings> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULT_REMINDER_SETTINGS }

  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from("reminder_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
    return normalizeSettings(data as Partial<ReminderSettings> | null)
  } catch (error) {
    console.error("getReminderSettings failed:", error)
    return { ...DEFAULT_REMINDER_SETTINGS }
  }
}

export async function saveReminderSettings(
  input: ReminderSettings
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: "You must be signed in to save." }

  // Light validation/clamping.
  const settings = normalizeSettings(input)
  if (settings.recipients.length === 0) {
    return { ok: false, message: "Add at least one weekly recipient email." }
  }

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.from("reminder_settings").upsert({
      id: 1,
      weekly_day: Math.min(6, Math.max(0, settings.weekly_day)),
      weekly_hour: Math.min(23, Math.max(0, settings.weekly_hour)),
      recipients: settings.recipients,
      followup_enabled: settings.followup_enabled,
      followup_days_after: Math.min(6, Math.max(1, settings.followup_days_after)),
      stale_threshold_days: Math.max(1, settings.stale_threshold_days),
      na_digest_enabled: settings.na_digest_enabled,
      na_recipients: settings.na_recipients,
      social_reminder_enabled: settings.social_reminder_enabled,
      social_recipients: settings.social_recipients,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    revalidatePath("/dashboard/prices/reminders")
    return { ok: true, message: "Reminder settings saved." }
  } catch (error) {
    console.error("saveReminderSettings failed:", error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save settings.",
    }
  }
}

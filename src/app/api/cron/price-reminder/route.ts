import { NextRequest, NextResponse } from "next/server"
import { getDetroitParts } from "@/lib/email/schedule"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { normalizeSettings, type ReminderSettings } from "@/lib/email/settings"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"
import { sendFollowupReminder } from "@/lib/email/send-followup"
import { sendNADigest } from "@/lib/email/send-na-digest"
import { getStaleRetailers, getRecentNAProducts } from "@/lib/email/reminder-data"

export const dynamic = "force-dynamic"

// Runs once daily at 13:00 UTC (~9 AM US Eastern; see vercel.json — daily is the
// max frequency on the current Vercel plan). Reads the editable schedule from
// reminder_settings and fires the weekly reminder, the follow-up, and the N/A
// digest when the current America/Detroit weekday matches.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  // Guard against a missing secret so an unset env var can't be matched by
  // `Bearer undefined` and turn into an auth bypass.
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  let admin
  try {
    admin = createSupabaseAdminClient()
  } catch (error) {
    console.error("reminder cron: admin client unavailable:", error)
    return new NextResponse("Admin client unavailable", { status: 500 })
  }

  const { data } = await admin.from("reminder_settings").select("*").eq("id", 1).maybeSingle()
  const settings = normalizeSettings(data as Partial<ReminderSettings> | null)

  // Daily cron → gate on the weekday only (a single run per day).
  const { weekday } = getDetroitParts(new Date())
  const actions: Record<string, unknown> = {}

  try {
    // Weekly reminder
    if (weekday === settings.weekly_day) {
      const r = await sendPriceReminder({ to: settings.recipients })
      actions.weekly = r.id
    }

    // Follow-up + N/A digest: `followup_days_after` days after the weekly day.
    const followupDay = (settings.weekly_day + settings.followup_days_after) % 7
    if (weekday === followupDay) {
      if (settings.followup_enabled) {
        const stale = await getStaleRetailers(admin, settings.stale_threshold_days)
        if (stale.length > 0) {
          const r = await sendFollowupReminder(settings.recipients, stale)
          actions.followup = { id: r.id, count: stale.length }
        }
      }
      if (settings.na_digest_enabled) {
        const na = await getRecentNAProducts(admin, 7)
        if (na.length > 0) {
          const r = await sendNADigest(settings.na_recipients, na)
          actions.naDigest = { id: r.id, count: na.length }
        }
      }
    }
  } catch (error) {
    console.error("reminder cron send failed:", error)
    return new NextResponse("Send failed", { status: 500 })
  }

  return NextResponse.json({ ran: true, weekday, actions })
}

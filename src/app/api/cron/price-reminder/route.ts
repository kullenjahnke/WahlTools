import { NextRequest, NextResponse } from "next/server"
import { getDetroitParts } from "@/lib/email/schedule"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { normalizeSettings, type ReminderSettings } from "@/lib/email/settings"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"
import { sendFollowupReminder } from "@/lib/email/send-followup"
import { sendNADigest } from "@/lib/email/send-na-digest"
import { getStaleRetailers, getRecentNAProducts, getUpcomingAndOverduePosts } from "@/lib/email/reminder-data"
import { sendSocialReminder } from "@/lib/email/send-social-reminder"
import { zernioAdapter } from "@/lib/publishing/zernio-client"
import { cleanupOldPostedAssets } from "@/lib/social/asset-cleanup"
import { normalizeSocialSettings } from "@/lib/config/social-settings"

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

  // Reconcile: catch any publish results the webhook missed. Checks scheduled
  // posts whose time has passed and that have a vendor id.
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min grace
    const { data: due } = await admin
      .from("social_posts")
      .select("id, external_ref, scheduled_at")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", cutoff)
    let reconciled = 0
    for (const row of (due ?? []) as { id: string; external_ref: { vendorId?: string; croppedPaths?: string[] } | null }[]) {
      const vendorId = row.external_ref?.vendorId
      if (!vendorId) continue
      try {
        const st = await zernioAdapter.getStatus(vendorId)
        console.log("reconcile: getStatus", { postId: row.id, vendorId, status: st.status })
        if (st.status === "posted" || st.status === "partial") {
          await admin.from("social_posts").update({ status: "posted", posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id)
          const cp = (row.external_ref as { croppedPaths?: string[] } | null)?.croppedPaths
          if (cp?.length) await admin.storage.from('social-media').remove(cp)
          reconciled++
        } else if (st.status === "failed") {
          await admin.from("social_posts").update({ status: "failed", failure_reason: st.error ?? "Publish failed", updated_at: new Date().toISOString() }).eq("id", row.id)
          reconciled++
        } else if (st.status === "cancelled") {
          await admin.from("social_posts").update({
            status: "failed",
            failure_reason: "Cancelled or removed at the vendor",
            external_ref: null,
            updated_at: new Date().toISOString(),
          }).eq("id", row.id)
          const cp = (row.external_ref as { croppedPaths?: string[] } | null)?.croppedPaths
          if (cp?.length) await admin.storage.from('social-media').remove(cp)
          reconciled++
        }
      } catch (e) {
        console.error("reconcile getStatus failed for", row.id, e)
      }
    }
    if (reconciled) actions.reconciled = reconciled
  } catch (error) {
    console.error("publish reconcile failed:", error)
    actions.reconcileError = true
  }

  // Social digest — independent of the weekday gating; runs daily (morning-of).
  try {
    if (settings.social_reminder_enabled) {
      const socialPosts = await getUpcomingAndOverduePosts(admin)
      if (socialPosts.length > 0) {
        const r = await sendSocialReminder(settings.social_recipients, socialPosts)
        actions.social = { id: r.id, count: socialPosts.length }
      }
    }
  } catch (error) {
    console.error("social reminder send failed:", error)
    actions.socialError = true
  }

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

  // Asset cleanup: delete original media of posted posts older than the retention
  // window (social_settings.asset_retention_days; 0 disables). Posted-only,
  // irreversible. Cropped derivatives + vendor-hosted copies are untouched.
  try {
    const { data: socialRow } = await admin
      .from("social_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
    const social = normalizeSocialSettings(socialRow as Parameters<typeof normalizeSocialSettings>[0])
    if (social.asset_retention_days > 0) {
      const summary = await cleanupOldPostedAssets(admin, social.asset_retention_days)
      if (summary.processedPosts > 0 || summary.capped || summary.storageError) {
        console.log("asset cleanup:", JSON.stringify(summary))
        actions.assetCleanup = summary
      }
    }
  } catch (error) {
    console.error("asset cleanup failed:", error)
    actions.assetCleanupError = true
  }

  return NextResponse.json({ ran: true, weekday, actions })
}

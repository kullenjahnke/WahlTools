import { getResend } from "./resend"
import { EMAIL_FROM } from "./config"
import { emailShell, emailList } from "./shell"
import type { SocialPostReminderEntry } from "./reminder-data"

const SOCIAL_URL = "https://wahlburgers-price-tracker.vercel.app/dashboard/social"

export function buildSocialReminderEmail(items: SocialPostReminderEntry[], opts?: { test?: boolean }) {
  const prefix = opts?.test ? "[Test] " : ""
  const overdue = items.filter((i) => i.overdue).length
  const subject = `${prefix}${items.length} social post${items.length === 1 ? "" : "s"} to handle today${overdue ? ` (${overdue} overdue)` : ""}`
  const intro = "Posts scheduled for today, plus any past their time that haven't posted (these may have failed and need a look)."

  const html = emailShell({
    heading: "Social posts that need attention",
    intro,
    bodyHtml: emailList(items.map((i) => ({ label: i.caption, sub: i.overdue ? `OVERDUE · ${i.when}` : i.when }))),
    ctaLabel: "Open Social Calendar",
    ctaUrl: SOCIAL_URL,
    footer: "Automated social reminder from WahlTools.",
  })

  const text = [
    "Social posts for today:",
    "",
    ...items.map((i) => `- ${i.caption} — ${i.overdue ? `OVERDUE (${i.when})` : i.when}`),
    "",
    `Open the calendar: ${SOCIAL_URL}`,
    "",
    "— WahlTools",
  ].join("\n")

  return { subject, html, text }
}

export async function sendSocialReminder(
  to: string[],
  items: SocialPostReminderEntry[],
  opts?: { test?: boolean }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildSocialReminderEmail(items, opts)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}

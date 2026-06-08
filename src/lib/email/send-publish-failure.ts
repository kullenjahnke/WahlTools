import { getResend } from "./resend"
import { EMAIL_FROM } from "./config"
import { emailShell } from "./shell"

const SOCIAL_URL = "https://wahlburgers-price-tracker.vercel.app/dashboard/social"

export function buildPublishFailureEmail(input: { label: string; reason: string; when: string | null }) {
  const subject = `⚠️ Social post failed to publish: ${input.label}`
  const whenLine = input.when
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" }).format(new Date(input.when))
    : "now"
  const html = emailShell({
    heading: "A scheduled post failed to publish",
    intro: `"${input.label}" (scheduled for ${whenLine}) didn't publish. Reason: ${input.reason}. Open the calendar to fix and reschedule.`,
    ctaLabel: "Open Social Calendar",
    ctaUrl: SOCIAL_URL,
    footer: "Automated publish-failure alert from WahlTools.",
  })
  const text = [
    `Social post failed to publish: ${input.label}`,
    `Scheduled for: ${whenLine}`,
    `Reason: ${input.reason}`,
    "",
    `Open the calendar: ${SOCIAL_URL}`,
    "",
    "— WahlTools",
  ].join("\n")
  return { subject, html, text }
}

export async function sendPublishFailure(
  to: string[],
  input: { label: string; reason: string; when: string | null }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildPublishFailureEmail(input)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}

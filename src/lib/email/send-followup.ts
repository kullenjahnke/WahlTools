import { getResend } from "./resend"
import { EMAIL_FROM, PRICES_URL } from "./config"
import { emailShell, emailList } from "./shell"
import type { StaleRetailer } from "./reminder-data"

function staleLabel(s: StaleRetailer): string {
  if (s.days == null) return "no prices recorded yet"
  return `last updated ${s.days} days ago`
}

export function buildFollowupEmail(stale: StaleRetailer[], opts?: { test?: boolean }) {
  const prefix = opts?.test ? "[Test] " : ""
  const subject = `${prefix}${stale.length} retailer${stale.length === 1 ? "" : "s"} still need a price check`
  const intro =
    "These retailers haven't had a price update recently. A quick check keeps the tracker accurate."

  const html = emailShell({
    heading: "Some retailers still need a price check",
    intro,
    bodyHtml: emailList(stale.map((s) => ({ label: s.retailer, sub: staleLabel(s) }))),
    ctaLabel: "Update Prices",
    ctaUrl: PRICES_URL,
    footer: "Automated follow-up from WahlTools.",
  })

  const text = [
    "These retailers haven't had a recent price update:",
    "",
    ...stale.map((s) => `- ${s.retailer} (${staleLabel(s)})`),
    "",
    `Open the Prices page: ${PRICES_URL}`,
    "",
    "— WahlTools",
  ].join("\n")

  return { subject, html, text }
}

export async function sendFollowupReminder(
  to: string[],
  stale: StaleRetailer[],
  opts?: { test?: boolean }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildFollowupEmail(stale, opts)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}

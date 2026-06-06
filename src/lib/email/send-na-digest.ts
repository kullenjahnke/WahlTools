import { getResend } from "./resend"
import { EMAIL_FROM, PRICES_URL } from "./config"
import { emailShell, emailList } from "./shell"
import type { NAProductEntry } from "./reminder-data"

export function buildNADigestEmail(items: NAProductEntry[], opts?: { test?: boolean }) {
  const prefix = opts?.test ? "[Test] " : ""
  const subject = `${prefix}${items.length} product${items.length === 1 ? "" : "s"} marked unavailable this week`
  const intro =
    "The following products were marked N/A (not available) at these retailers this week. " +
    "Consider removing the retailer from the product if it's no longer carried."

  const html = emailShell({
    heading: "Products marked unavailable this week",
    intro,
    bodyHtml: emailList(items.map((i) => ({ label: i.product, sub: i.retailer }))),
    ctaLabel: "Review Products",
    ctaUrl: PRICES_URL,
    footer: "Automated N/A digest from WahlTools.",
  })

  const text = [
    "Products marked unavailable (N/A) this week:",
    "",
    ...items.map((i) => `- ${i.product} @ ${i.retailer}`),
    "",
    `Review on the Prices page: ${PRICES_URL}`,
    "",
    "— WahlTools",
  ].join("\n")

  return { subject, html, text }
}

export async function sendNADigest(
  to: string[],
  items: NAProductEntry[],
  opts?: { test?: boolean }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildNADigestEmail(items, opts)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}

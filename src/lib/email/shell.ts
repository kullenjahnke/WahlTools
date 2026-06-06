import { EMAIL_LOGO_URL, ACCENT_COLOR, PRICES_URL } from "./config"

// Shared branded HTML shell for transactional emails, matching the weekly
// reminder template's look.
export function emailShell(opts: {
  heading: string
  intro: string
  /** Optional inner HTML (e.g. a list) rendered above the CTA. */
  bodyHtml?: string
  ctaLabel?: string
  ctaUrl?: string
  footer?: string
}): string {
  const { heading, intro, bodyHtml = "", ctaLabel = "Open Prices", ctaUrl = PRICES_URL, footer } = opts
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#18181b;padding:28px 32px;">
                <img src="${EMAIL_LOGO_URL}" alt="WahlTools" width="180" style="display:block;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;" />
                <div style="color:#a1a1aa;font-size:12px;margin-top:8px;">Wahlburgers at Home &mdash; Price Tracker</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">${heading}</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f3f46;">${intro}</p>
                ${bodyHtml}
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:${ACCENT_COLOR};">
                      <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${ctaLabel} &rarr;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #f4f4f5;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">${footer ?? "You're receiving this automated message from WahlTools."}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// Renders a simple list block (label + optional muted suffix) for email bodies.
export function emailList(items: { label: string; sub?: string }[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:14px;color:#18181b;">${i.label}${
          i.sub ? ` <span style="color:#a1a1aa;">&middot; ${i.sub}</span>` : ""
        }</td></tr>`
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${rows}</table>`
}

import { PRICES_URL, EMAIL_LOGO_URL, ACCENT_COLOR } from "./config"

// Pure: returns the rendered email parts. `test` only affects the subject prefix.
export function buildPriceReminderEmail(opts?: { test?: boolean }): {
  subject: string
  html: string
  text: string
} {
  const prefix = opts?.test ? "[Test] " : ""
  const subject = `${prefix}Time to update this week's prices`

  const text = [
    "It's a new week — time to update prices for Wahlburgers at Home.",
    "",
    `Open the Prices page: ${PRICES_URL}`,
    "",
    "— WahlTools",
  ].join("\n")

  const html = `<!doctype html>
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
                <h1 style="margin:0 0 12px;font-size:20px;color:#18181b;">It's time to update this week's prices</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46;">
                  A new week means fresh retailer pricing. Head to the Prices page to record this week's numbers across all retailers.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:8px;background-color:${ACCENT_COLOR};">
                      <a href="${PRICES_URL}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Update Prices &rarr;</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #f4f4f5;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;">You're receiving this weekly reminder from WahlTools.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}

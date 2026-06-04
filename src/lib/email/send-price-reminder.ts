import { getResend } from "./resend"
import { EMAIL_FROM, REMINDER_RECIPIENTS } from "./config"
import { buildPriceReminderEmail } from "./price-reminder-template"

// Sends the reminder. `to` overrides recipients (used by the test send).
export async function sendPriceReminder(opts?: {
  to?: string[]
  test?: boolean
}): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildPriceReminderEmail({ test: opts?.test })
  const to = opts?.to ?? REMINDER_RECIPIENTS

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  })

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  }
  return { id: data?.id ?? "" }
}

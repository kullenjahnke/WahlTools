# Weekly Price-Reminder Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a branded weekly price-reminder email (Wednesday 9 AM America/Detroit) via Resend + Vercel Cron, with a manual test-send button.

**Architecture:** Small single-purpose modules under `src/lib/email/` (config, client, pure template, pure timezone gate, send composer). A `GET /api/cron/price-reminder` endpoint verifies the `CRON_SECRET` bearer and sends only when the timezone gate passes. Two weekly UTC crons (`0 13 * * 3`, `0 14 * * 3`) make exactly one fire at 9 AM Eastern year-round. A server action + client button on the Reminders page sends a `[Test]` email to the logged-in user.

**Tech Stack:** Next.js 15 App Router, TypeScript, Resend SDK, Vercel Cron, `Intl.DateTimeFormat` for timezone (no date lib), shadcn `useToast`.

**Note on testing:** Per the approved spec, no test framework is added. Verification = a throwaway Node script for the pure timezone gate, `pnpm build`, `pnpm lint`, and a live test send.

---

## Part A — Feature correctness review (do first)

### Task 1: Review core flows and report

**Files:** none modified yet (investigation; trivial fixes inline with approval).

- [ ] **Step 1: Review these areas and note findings**
  - `recordPriceCheck` action + `record_price_check` RPC (`migrations/13_*.sql`) — atomicity, status transitions.
  - `getPriceChangeStats` in `src/app/actions/prices.ts` — EST/week-boundary math.
  - `fetchProductPriceHistory` + `src/app/api/prices/history/route.ts` — date filtering.
  - Comparison (`enhanced-product-comparison`) + analytics (`product-analytics`) — null/empty handling.
  - Export (`export-modal`) — CSV/Excel output.
  - Existing Reminders UI (`price-check-reminders.tsx`): confirmed it writes to a `price_check_reminders` table that **no code reads** — i.e. the per-retailer reminder settings do nothing. Flag as a product decision (do not auto-remove; out of scope for this phase).
- [ ] **Step 2: Produce a findings list** (issue, location, severity, proposed action). Fix only trivial issues inline; flag non-trivial for approval at the checkpoint. Do not commit feature changes without sign-off.

---

## Part B — Email reminder

### Task 2: Install Resend + scaffold env

**Files:**
- Modify: `package.json` (via pnpm)
- Modify: `.env.local` (git-ignored)
- Create: `.env.example`

- [ ] **Step 1: Install the Resend SDK**

Run: `pnpm add resend`
Expected: `resend` added to `dependencies`.

- [ ] **Step 2: Generate a CRON_SECRET value**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Copy the output for the next step.

- [ ] **Step 3: Append secrets to `.env.local`** (do NOT commit this file)

```
RESEND_API_KEY=re_MAAAFfu9_2bx9VDquY8F9Zenpk4zh7hgV
CRON_SECRET=<paste the value generated in Step 2>
```

- [ ] **Step 4: Create `.env.example`** (names only — safe to commit)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AUTHORIZED_EMAILS=
RESEND_API_KEY=
CRON_SECRET=
```

- [ ] **Step 5: Commit** (lockfile + example only)

```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "Phase 3: add resend dep and env scaffolding"
```

---

### Task 3: Email config module

**Files:**
- Create: `src/lib/email/config.ts`

- [ ] **Step 1: Write the config**

```ts
// Centralized, easy-to-edit email constants.
export const EMAIL_FROM = "WahlTools <noreply@reminders.arkkfood.com>"

// Recipients for the scheduled Wednesday send.
export const REMINDER_RECIPIENTS = [
  "info@kullenjahnke.com",
  "rjahnke@arkkfood.com",
]

// Button target in the email.
export const PRICES_URL =
  "https://wahlburgers-price-tracker.vercel.app/dashboard/prices"
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/config.ts
git commit -m "Phase 3: add email config constants"
```

---

### Task 4: Timezone gate (pure) + verification script

**Files:**
- Create: `src/lib/email/schedule.ts`

- [ ] **Step 1: Write the gate**

```ts
// Pure timezone logic. Returns America/Detroit weekday (0=Sun..6=Sat) and hour (0-23).
export function getDetroitParts(date: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date)

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? ""
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0"

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  let hour = parseInt(hourStr, 10)
  if (hour === 24) hour = 0 // some runtimes emit "24" for midnight with hour12:false

  return { weekday: weekdayMap[weekdayStr] ?? -1, hour }
}

// True only at the 9 AM Wednesday America/Detroit hour.
export function shouldSendReminder(date: Date): boolean {
  const { weekday, hour } = getDetroitParts(date)
  return weekday === 3 && hour === 9
}
```

- [ ] **Step 2: Verify the gate with a throwaway script**

Run:
```bash
npx tsx -e "
import { getDetroitParts, shouldSendReminder } from './src/lib/email/schedule';
const cases = [
  ['Summer 13:00 UTC Wed', new Date(Date.UTC(2026,6,1,13,30))], // Jul 1 2026 is a Wed
  ['Summer 14:00 UTC Wed', new Date(Date.UTC(2026,6,1,14,30))],
  ['Winter 13:00 UTC Wed', new Date(Date.UTC(2026,0,7,13,30))], // Jan 7 2026 is a Wed
  ['Winter 14:00 UTC Wed', new Date(Date.UTC(2026,0,7,14,30))],
  ['Tue 14:00 UTC',        new Date(Date.UTC(2026,0,6,14,30))],
];
for (const [label, d] of cases) {
  const p = getDetroitParts(d);
  console.log(label, '→ Detroit weekday', p.weekday, 'hour', p.hour, '| send:', shouldSendReminder(d));
}
"
```
Expected (proves exactly one of 13:00/14:00 UTC sends per season, and only on Wednesday):
```
Summer 13:00 UTC Wed → Detroit weekday 3 hour 9 | send: true
Summer 14:00 UTC Wed → Detroit weekday 3 hour 10 | send: false
Winter 13:00 UTC Wed → Detroit weekday 3 hour 8 | send: false
Winter 14:00 UTC Wed → Detroit weekday 3 hour 9 | send: true
Tue 14:00 UTC        → Detroit weekday 2 hour 9 | send: false
```
(If `tsx` is unavailable, run `pnpm add -D tsx` first; remove it after if undesired.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/schedule.ts
git commit -m "Phase 3: add America/Detroit weekly send gate"
```

---

### Task 5: Resend client

**Files:**
- Create: `src/lib/email/resend.ts`

- [ ] **Step 1: Write the client factory**

```ts
import { Resend } from "resend"

// Lazily construct the client so a missing key fails at send time, not import time.
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set")
  }
  return new Resend(apiKey)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/resend.ts
git commit -m "Phase 3: add resend client factory"
```

---

### Task 6: Email template (pure)

**Files:**
- Create: `src/lib/email/price-reminder-template.ts`

- [ ] **Step 1: Write the template builder**

```ts
import { PRICES_URL } from "./config"

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
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#18181b;padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Wahl<span style="color:#e11d2a;">Tools</span></span>
                <div style="color:#a1a1aa;font-size:12px;margin-top:2px;">Wahlburgers at Home — Price Tracker</div>
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
                    <td style="border-radius:8px;background-color:#e11d2a;">
                      <a href="${PRICES_URL}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Update Prices →</a>
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
```

- [ ] **Step 2: Spot-check the rendered HTML**

Run:
```bash
npx tsx -e "import { buildPriceReminderEmail } from './src/lib/email/price-reminder-template'; const e = buildPriceReminderEmail(); console.log('subject:', e.subject); console.log('button present:', e.html.includes('Update Prices')); require('fs').writeFileSync('/tmp/reminder-preview.html', e.html);"
```
Expected: prints the subject and writes `/tmp/reminder-preview.html` (open it in a browser to eyeball the layout).

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/price-reminder-template.ts
git commit -m "Phase 3: add price reminder email template"
```

---

### Task 7: Send composer

**Files:**
- Create: `src/lib/email/send-price-reminder.ts`

- [ ] **Step 1: Write the sender**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/send-price-reminder.ts
git commit -m "Phase 3: add price reminder send composer"
```

---

### Task 8: Cron endpoint

**Files:**
- Create: `src/app/api/cron/price-reminder/route.ts`

- [ ] **Step 1: Write the handler**

```ts
import { NextRequest, NextResponse } from "next/server"
import { shouldSendReminder } from "@/lib/email/schedule"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  if (!shouldSendReminder(new Date())) {
    // Not the 9 AM Wednesday Detroit window — the other weekly cron will handle it.
    return new NextResponse(null, { status: 204 })
  }

  try {
    const result = await sendPriceReminder()
    return NextResponse.json({ sent: true, id: result.id })
  } catch (error) {
    console.error("price-reminder cron failed:", error)
    return new NextResponse("Send failed", { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the auth gate locally**

Run (dev server must be running via `pnpm dev`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/price-reminder
```
Expected: `401` (no bearer). With the correct bearer on a non-Wednesday-9AM moment, expect `204`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/price-reminder/route.ts
git commit -m "Phase 3: add price reminder cron endpoint"
```

---

### Task 9: Vercel cron schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/price-reminder", "schedule": "0 13 * * 3" },
    { "path": "/api/cron/price-reminder", "schedule": "0 14 * * 3" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "Phase 3: add Wednesday cron schedule (DST-safe pair)"
```

---

### Task 10: Manual test-send (server action + button)

**Files:**
- Create: `src/app/actions/reminders.ts`
- Create: `src/components/prices/send-test-reminder-button.tsx`
- Modify: `src/app/(dashboard)/dashboard/prices/reminders/page.tsx`

- [ ] **Step 1: Write the server action**

```ts
"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { sendPriceReminder } from "@/lib/email/send-price-reminder"

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
```

- [ ] **Step 2: Write the client button**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send } from "lucide-react"
import { sendTestPriceReminder } from "@/app/actions/reminders"

export function SendTestReminderButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleClick() {
    setLoading(true)
    const res = await sendTestPriceReminder()
    toast({
      title: res.ok ? "Sent" : "Error",
      description: res.message,
      variant: res.ok ? undefined : "destructive",
    })
    setLoading(false)
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={handleClick}>
      <Send className="h-4 w-4 mr-2" />
      {loading ? "Sending…" : "Send test reminder"}
    </Button>
  )
}
```

- [ ] **Step 3: Add the button to the Reminders page header**

In `src/app/(dashboard)/dashboard/prices/reminders/page.tsx`, add the import and render the button in the top flex row (opposite the Back button).

Replace:
```tsx
import { PriceCheckReminders } from "@/components/prices/price-check-reminders"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
```
with:
```tsx
import { PriceCheckReminders } from "@/components/prices/price-check-reminders"
import { SendTestReminderButton } from "@/components/prices/send-test-reminder-button"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
```

Replace:
```tsx
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/prices">
              <ChevronLeft className="h-4 w-4" />
              Back to Prices
            </Link>
          </Button>
        </div>
      </div>
```
with:
```tsx
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/prices">
              <ChevronLeft className="h-4 w-4" />
              Back to Prices
            </Link>
          </Button>
        </div>
        <SendTestReminderButton />
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/reminders.ts src/components/prices/send-test-reminder-button.tsx "src/app/(dashboard)/dashboard/prices/reminders/page.tsx"
git commit -m "Phase 3: add manual test-send button on reminders page"
```

---

### Task 11: Full verification

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: `✓ Compiled successfully`, and `/api/cron/price-reminder` appears in the route list.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 3: Live test send**

With `pnpm dev` running and signed in, click **Send test reminder** on `/dashboard/prices/reminders`. Confirm the toast shows success and the email arrives at `info@kullenjahnke.com` from `WahlTools <noreply@reminders.arkkfood.com>`, with a working "Update Prices" button.

- [ ] **Step 4: Confirm `.env.local` is NOT staged anywhere**

Run: `git status --porcelain | grep env.local || echo "clean"`
Expected: `clean`.

---

## Post-implementation (manual, outside the plan)

- Add `RESEND_API_KEY` and `CRON_SECRET` to the Vercel project environment variables (Production + Preview).
- Redeploy so Vercel registers the cron jobs from `vercel.json`.
- (Recommended) Rotate the Resend API key, since it was shared in plaintext.

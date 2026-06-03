# Weekly Price-Reminder Email — Design Spec

**Date:** 2026-06-03
**Phase:** 3 (of the WahlTools cleanup + features engagement)
**Branch:** `wahltools-cleanup-and-features`

## Goal

Send a branded weekly email reminding the team to update prices for the new
week. Delivered **Wednesday at 9:00 AM America/Detroit (Eastern)**, year-round,
via Resend + Vercel Cron. Include a one-click button to the Prices page and a
way to manually trigger a test send.

This phase also includes a **feature-correctness review** of the existing app
(Part A) performed before building the email (Part B).

---

## Part A — Feature correctness review (no new feature code)

A focused pass over the core flows:

- Price recording / the `record_price_check` RPC and `recordPriceCheck` action
- Price history queries (`fetchProductPriceHistory`, `/api/prices/history`)
- Week-over-week stats (`getPriceChangeStats`, EST handling)
- Comparison + analytics rendering
- CSV/Excel export
- Auth / registration whitelist

**Process:** report all findings at Checkpoint 3. Fix trivial issues inline;
flag anything non-trivial for approval before changing it. (One latent bug was
already found and removed in Phase 2: a dashboard query filtering on `brand_id`
with the string `'competitor'` instead of `brand_type`.)

---

## Part B — Weekly email reminder

### Configuration (verified facts)

- **Sending domain:** `reminders.arkkfood.com` — verified in Resend.
- **FROM:** `WahlTools <noreply@reminders.arkkfood.com>`
- **Recipients (scheduled send):** `info@kullenjahnke.com`, `rjahnke@arkkfood.com`
- **Prices URL (button target):** `https://wahlburgers-price-tracker.vercel.app/dashboard/prices`
- **Vercel plan:** Hobby — cron max frequency is once/day; may fire anytime
  within the scheduled hour. Weekly schedules are allowed. No upgrade required.

### Module layout (small, single-purpose units)

| File | Responsibility |
|---|---|
| `src/lib/email/config.ts` | Typed constants: `FROM`, `RECIPIENTS`, `PRICES_URL`. Single edit point. |
| `src/lib/email/resend.ts` | Initialize the Resend client from `RESEND_API_KEY`. |
| `src/lib/email/price-reminder-template.ts` | **Pure** function → `{ subject, html, text }`. Wordmark header, short copy, one CTA button. Inline-CSS, email-client-safe. No `react-email` dep. |
| `src/lib/email/schedule.ts` | **Pure** `shouldSendReminder(now: Date): boolean` → true only when it is Wednesday 9 AM in America/Detroit. Uses `Intl.DateTimeFormat` with `timeZone` (no date library). The DST-handling core. |
| `src/lib/email/send-price-reminder.ts` | Compose from/recipients/subject and call Resend. Accepts an optional recipient override (for the test send). |
| `src/app/api/cron/price-reminder/route.ts` | GET handler. Verify `CRON_SECRET` bearer → gate on `shouldSendReminder` → send or no-op. |
| `src/app/actions/reminders.ts` | `sendTestPriceReminder()` server action: requires a logged-in session, sends only to that user's email with a `[Test]` subject prefix. |
| `vercel.json` | Two weekly Wednesday cron entries (see below). |
| Reminders page edit | Add a "Send test reminder" button wired to the server action. |

### Cron + DST strategy (Hobby-safe, exact 9 AM year-round)

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/price-reminder", "schedule": "0 13 * * 3" },
    { "path": "/api/cron/price-reminder", "schedule": "0 14 * * 3" }
  ]
}
```

America/Detroit is UTC−4 (EDT, summer) or UTC−5 (EST, winter). So:

- **Summer (EDT):** 13:00 UTC = 9:xx AM Detroit → `shouldSendReminder` true → send.
  14:00 UTC = 10:xx AM → false → no-op.
- **Winter (EST):** 13:00 UTC = 8:xx AM → no-op. 14:00 UTC = 9:xx AM → send.

Exactly one fires the send each Wednesday → **no double-send, no DB state
needed**. Robust to Hobby's within-the-hour jitter because the jitter stays
inside a single Detroit clock hour. DST transitions occur only on Sundays, so
Wednesday is never ambiguous.

**Fallback** (only if Vercel rejects the weekly day-of-week expression on
Hobby): change both schedules to daily (`0 13 * * *`, `0 14 * * *`). The
handler gate already checks weekday === Wednesday, so behavior is identical;
the function simply gets invoked (and no-ops) the other six days.

### Endpoint behavior

`GET /api/cron/price-reminder`:

1. If `Authorization` header ≠ `Bearer ${CRON_SECRET}` → `401`.
2. If `!shouldSendReminder(new Date())` → `204` (no-op, logged).
3. Else send to `RECIPIENTS`; on success `200`, on Resend failure log + `500`.

### Manual test trigger

- Button "Send test reminder" on `/dashboard/prices/reminders`.
- Calls `sendTestPriceReminder()` server action.
- Requires an authenticated Supabase session (else throws / returns error).
- **Sends only to the logged-in user's email**, subject prefixed `[Test]`, so
  repeated testing does not spam the second recipient.
- Surfaces success/error via the existing toast system.

### Environment variables

- `RESEND_API_KEY` — provided by user; stored in `.env.local` (git-ignored) and
  added to Vercel project env. **Recommend rotating after Phase 3** since it was
  shared in plaintext.
- `CRON_SECRET` — strong random value generated during implementation; added to
  both `.env.local` and Vercel. Vercel automatically sends it as the cron
  Authorization bearer.

### Error handling

- Missing `RESEND_API_KEY` → client init throws; handler returns 500 with a
  logged message.
- Resend API error → logged; handler returns 500 (visible in Vercel logs); test
  action returns a user-facing error toast.
- Bad/missing `CRON_SECRET` on the endpoint → 401.

### Verification plan

- `shouldSendReminder`: run a throwaway Node script printing Detroit
  weekday/hour for sample summer + winter UTC timestamps, proving the gate fires
  exactly once at 9 AM local. Output shown at Checkpoint 3.
- `pnpm build` + `pnpm lint` pass.
- Live test send via the button at Checkpoint 3 (domain is verified, so the
  branded FROM works directly).

### Out of scope (YAGNI)

- No test framework added (project currently has none).
- No `react-email` dependency (hand-written HTML is sufficient for one email).
- No persisted send-log / idempotency table (the two-cron + hour gate removes
  the need).
- No per-recipient preferences UI.

### Logo dependency

Email uses a styled **text wordmark** now. When the favicon/logo is provided in
Phase 4, host it (e.g. `/public`) and swap the image into the template header
via absolute URL.

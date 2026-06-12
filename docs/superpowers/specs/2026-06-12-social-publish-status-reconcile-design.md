# A2 — Fix: published post stays "scheduled" + false "not posted" email

**Track:** A (Social / Post Scheduling) — **bug fix**
**Branch:** `fix/social-publish-status-reconcile`
**Status:** Root cause confirmed (systematic-debugging) — fix approved, ready for implementation plan

## Symptom

A scheduled post published successfully through Zernio, but its status never auto-updated from
`scheduled` to `posted`, and a "not posted" email was sent.

## Root cause (confirmed with evidence)

### ② Status never converged — webhook post-id mismatch (PRIMARY)

The webhook reads the vendor post id at `payload.post._id`
(`src/app/api/webhooks/zernio/route.ts:33`), but Zernio's **webhook** payload delivers it at
`payload.post.id` (no underscore). Evidenced by the actual delivered payload:

```jsonc
{
  "id": "7c3c9b39-…",            // delivery id (not the post id)
  "event": "post.published",
  "post": {
    "id": "6a2abfedf4b50933af8aeb6b",   // <-- post id lives here, as `id`
    "status": "published",
    "platforms": [
      { "platform": "instagram", "status": "published", "platformPostId": "…", "publishedUrl": "…" },
      { "platform": "facebook",  "status": "published", "platformPostId": "…", "publishedUrl": "…" }
    ]
  },
  "timestamp": "2026-06-11T15:04:24.297Z"
}
```

Because `payload.post._id` is `undefined`, the handler hits
`if (!vendorId) return … { ignored: 'no post id' }` and returns **HTTP 200 with no DB update**. That
is why Zernio's delivery log shows a *successful* `post.published` delivery while the status stayed
`scheduled`. (The asymmetry: REST *response* bodies use `_id` — so `createPost`/`getStatus` read
`_id` correctly — but the *webhook* payload uses `id`.)

### ① False "not posted" email — cron ordering (SECONDARY)

The "not posted" email is the **social reminder digest** (`sendSocialReminder`), not the
publish-failure alert. Its intro reads *"plus any past their time that haven't posted (these may have
failed and need a look)"* and tags the post **OVERDUE** (`src/lib/email/reminder-data.ts:91`,
`src/lib/email/send-social-reminder.ts:12`). The real failure alert (`sendPublishFailure`) only fires
from the webhook's `post.partial`/`post.failed` branches, both of which also move status away from
`scheduled` — so since status stayed `scheduled`, that alert provably did not fire.

In the cron, the digest runs (`src/app/api/cron/price-reminder/route.ts:45-56`) **before** the publish
reconcile (`…:88-121`). So within a single run, a post that actually published but whose status is
stale (because of ②) is emailed as "haven't posted" *before* the reconcile would flip it to `posted`.

## Fix

Scope: **ordering + no-false-email + logging** (no convergence over-hardening).

### F1 — Webhook reads the correct post id
In `src/app/api/webhooks/zernio/route.ts`:
- Type the payload `post` to include `id?: string` (keep `_id?: string`).
- Resolve `const vendorId = payload.post?.id ?? payload.post?._id` (prefer `id`; `_id` kept as a
  harmless fallback in case the vendor ever changes).

This restores real-time status convergence: the webhook matches the post by
`external_ref->>vendorId` and sets `status='posted'` within seconds of publishing. (The stored
`external_ref.vendorId` is the same Zernio post id, captured from the REST create response, so the
lookup matches once the id is read correctly.)

### F2 — Reconcile before the social digest
In `src/app/api/cron/price-reminder/route.ts`, move the **reconcile** block (currently lines ~88-121)
to run **before** the **social reminder digest** block (currently lines ~44-56). Order within the
cron becomes: weekly/follow-up/N-A gating unaffected → reconcile due posts → THEN social digest →
asset cleanup. Result: any due post that actually posted is flipped to `posted` and therefore
excluded from the digest's `['scheduled','failed']` query, so it can't be reported as overdue.

> The weekly/follow-up/N-A digest block and the asset-cleanup block are independent of reconcile and
> the social digest; only the **reconcile** and **social digest** blocks are reordered relative to
> each other. Keep each block's existing try/catch and `actions` bookkeeping intact.

### F3 — Boundary logging (make silent failures visible)
Add structured `console` logging the webhook currently lacks, so a future miss is diagnosable in
Vercel logs:
- Webhook: log on invalid/missing signature (the 401), on `ignored: 'no post id'`, on
  `ignored: 'no matching post'`, and on the successful status update (include `event`, resolved
  `vendorId`, and matched `post.id`). Do **not** log secrets or raw signatures.
- Reconcile: log each due post's `getStatus` result and the action taken (posted / failed / left
  scheduled).

### No-false-email guarantee
F1 makes status converge in real time (so a post is `posted` long before any digest); F2 guarantees
that even a delayed or missed webhook cannot yield a false "not posted" email, because the reconcile
runs first. A fully-successful `post.published` never calls `notifyFailure`, so `sendPublishFailure`
remains impossible for a successful post.

## Out of scope (deferred — user chose minimal scope)
- Tolerating alternate signature encodings (base64 / `sha256=` prefix). Evidence shows the signature
  verified, so this is not the bug.
- Changing `normalizeStatus`'s default-to-`scheduled` behavior. Evidence shows `getStatus` returns
  the exact string `published`, which maps correctly; the reconcile path is sound.
- `post.partial` notification behavior (a partial is a legitimate partial-failure signal).
- The digest cross-checking vendor status before flagging overdue (not needed once reconcile-first).

## Verification

This repo has **no test runner**. Verify with `pnpm lint` + `pnpm build` (both clean), plus:

**Reproduction reasoning (the "failing case"):** feeding the delivered payload above, the old code
yields `vendorId === undefined` → `ignored: 'no post id'` → no update; the fixed code yields
`vendorId === '6a2abfedf4b50933af8aeb6b'` → matches `external_ref.vendorId` → `status='posted'`.

**Manual smoke (deployed Vercel build):**
- Schedule a post a few minutes out; after it publishes, confirm status auto-flips to `posted` (the
  webhook path), with no overdue email.
- Confirm a past-due still-`scheduled` post that actually posted is reconciled to `posted` in the
  cron run before the social digest is sent (so it is not listed as overdue).
- Confirm Vercel logs show the new webhook/reconcile boundary log lines.

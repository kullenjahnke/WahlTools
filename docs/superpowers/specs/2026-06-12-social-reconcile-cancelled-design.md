# Fix — vendor-cancelled posts in publish reconcile

**Track:** A follow-up (Social) — deferred from A2
**Branch:** `fix/social-reconcile-cancelled`
**Status:** Approved design — ready for implementation plan

## Problem

The daily publish reconcile (`src/app/api/cron/price-reminder/route.ts`) polls
`zernioAdapter.getStatus(vendorId)` for past-due `scheduled` social posts. `getStatus` maps a vendor
404 to `cancelled` (`src/lib/publishing/zernio-client.ts`). The reconcile loop only acts on
`posted`/`partial` (→ `posted`) and `failed` (→ `failed`); a `cancelled` result takes **no action**, so
a post whose vendor record is gone stays `status = 'scheduled'` forever and recurs in the daily
social "overdue / not posted" digest every day.

Additionally, the digest (`getUpcomingAndOverduePosts` in `src/lib/email/reminder-data.ts`) lists
**every** `failed` post unconditionally (status filter `['scheduled','failed']`, no age bound), so even
once a post is given a terminal `failed` status it would keep nagging forever — as do genuine failures
today.

## Decisions (settled in brainstorming)

- A vendor-`cancelled`/404 post is reconciled to **`failed`** with reason
  `"Cancelled or removed at the vendor"`, clearing the stale `external_ref` and removing orphaned
  cropped derivatives.
- The digest only surfaces **recent** failures: failed posts whose `scheduled_at` is within the last
  **7 days**. This stops the forever-nag for cancelled and genuine failures alike.

## Changes (no DB/migration, no UI)

### 1. Reconcile — handle `cancelled`
`src/app/api/cron/price-reminder/route.ts`: add a branch after the existing `failed` branch in the
reconcile loop:

```ts
        } else if (st.status === "cancelled") {
          await admin.from("social_posts").update({
            status: "failed",
            failure_reason: "Cancelled or removed at the vendor",
            external_ref: null,
            updated_at: new Date().toISOString(),
          }).eq("id", row.id)
          const cp = (row.external_ref as { croppedPaths?: string[] } | null)?.croppedPaths
          if (cp?.length) await admin.storage.from('social-media').remove(cp)
          reconciled++
        }
```

Once the post is `failed`, the reconcile query (`.eq("status", "scheduled")`) never selects it again.
Clearing `external_ref` drops the stale vendor pointer (the vendor post is gone) and frees the
orphaned cropped image derivatives.

### 2. Bound the digest's failed listing to recent
`src/lib/email/reminder-data.ts`, in `getUpcomingAndOverduePosts`: add a lookback constant and change
the `failed` branch to skip failures that are old or have no `scheduled_at`.

```ts
const FAILED_LOOKBACK_DAYS = 7
```

In the loop's `failed` branch:

```ts
    if (row.status === 'failed') {
      // Only surface recent failures so they don't nag forever (cancelled + genuine).
      if (!row.scheduled_at) continue
      if (nowMs - new Date(row.scheduled_at).getTime() > FAILED_LOOKBACK_DAYS * MS_PER_DAY) continue
      out.push({
        caption: row.title?.trim() || row.caption?.trim() || 'Untitled post',
        when: `${fmtDay.format(new Date(row.scheduled_at))} ${fmtTime.format(new Date(row.scheduled_at))}`,
        overdue: true,
      })
      continue
    }
```

(`MS_PER_DAY` and `nowMs` already exist in the file/function.)

## Edge cases
- A failed **publish-now** with no `scheduled_at` is skipped from the digest — it was surfaced live to
  the user at publish time, so it doesn't need recurring digest nagging.
- Overdue **scheduled** posts (the non-failed branch) are unaffected — still surfaced.
- A post that sat `scheduled` for >7 days before reconcile flips it to `failed` (rare, pre-existing
  stuck posts) would be marked failed but already outside the 7-day window, so not surfaced; acceptable
  given the A2 fix makes real-time/daily convergence the norm.

## Verification

No test runner. Verify with `pnpm lint` + `pnpm build` (clean). Live smoke is on the deployed daily
cron:
- A scheduled post deleted at the vendor → next reconcile flips it to **failed** ("Cancelled or removed
  at the vendor"), and it no longer appears as overdue in subsequent digests once older than 7 days.
- A recently-failed post still appears in the digest for ~7 days, then drops off.

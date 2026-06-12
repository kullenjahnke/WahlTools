# Vendor-Cancelled Reconcile Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give vendor-cancelled (404) scheduled posts a terminal `failed` status during reconcile, and stop the overdue digest from nagging about failed posts forever (bound to the last 7 days).

**Architecture:** Two small edits — one branch in the cron reconcile loop, one age-bound in the digest query helper. No DB/migration, no UI.

**Tech Stack:** Next.js route handler (cron) + a server-side query helper. No test runner — verification is `pnpm lint` + `pnpm build`.

---

## Note on verification
No unit-test runner. The gate is `pnpm lint` + `pnpm build` (both clean). Live behavior is exercised by
the deployed daily cron.

## File Structure
- **Modify** `src/app/api/cron/price-reminder/route.ts` — add a `cancelled` branch to the reconcile loop.
- **Modify** `src/lib/email/reminder-data.ts` — bound the digest's `failed` listing to the last 7 days.

Both belong to one cohesive fix; do them in one task.

---

## Task 1: Handle cancelled in reconcile + bound the failed digest

**Files:** Modify `src/app/api/cron/price-reminder/route.ts`, `src/lib/email/reminder-data.ts`.

- [ ] **Step 1: Add the `cancelled` branch to the reconcile loop**

In `src/app/api/cron/price-reminder/route.ts`, the reconcile loop currently ends with an
`else if (st.status === "failed") { … reconciled++ }` block. Immediately after that `failed` block (and
before the surrounding `} catch (e) {`), add:

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

Do not change the existing `posted`/`partial`/`failed` branches, the `console.log("reconcile: getStatus", …)`
line, or the surrounding try/catch.

- [ ] **Step 2: Add the failed-lookback constant**

In `src/lib/email/reminder-data.ts`, near the existing `const MS_PER_DAY = 86400000` (top of file), add:

```ts
const FAILED_LOOKBACK_DAYS = 7
```

- [ ] **Step 3: Bound the digest's `failed` branch**

In `getUpcomingAndOverduePosts`, replace the existing `failed` branch:

```ts
    if (row.status === 'failed') {
      out.push({
        caption: row.title?.trim() || row.caption?.trim() || 'Untitled post',
        when: row.scheduled_at ? `${fmtDay.format(new Date(row.scheduled_at))} ${fmtTime.format(new Date(row.scheduled_at))}` : 'Unknown',
        overdue: true,
      })
      continue
    }
```

with:

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

(`nowMs` and `MS_PER_DAY` already exist; `fmtDay`/`fmtTime` are already defined in the function.)

- [ ] **Step 4: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/cron/price-reminder/route.ts" src/lib/email/reminder-data.ts
git commit -m "fix(social): reconcile vendor-cancelled posts to failed; bound failed digest to 7 days

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `pnpm lint` + `pnpm build` clean.

**Manual smoke (deployed daily cron):**
- [ ] A scheduled post deleted at the vendor → next reconcile marks it **failed** ("Cancelled or removed
  at the vendor"); it no longer appears as overdue once older than 7 days.
- [ ] A recently-failed post still appears in the digest for ~7 days, then drops off.
- [ ] Overdue scheduled (non-failed) posts still surface as before.

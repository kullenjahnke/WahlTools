# Social Calendar — Phase 2: Live Publishing Design Spec

> **Status:** Approved (2026-06-08). Feeds the implementation plan (writing-plans).
> **Branch:** `feature/social-publishing`.
> **Builds on:** v1 ([2026-06-08-social-calendar-design.md](2026-06-08-social-calendar-design.md)),
> Gate 0 decision ([../../social-calendar/gate-0-publishing-research.md](../../social-calendar/gate-0-publishing-research.md)).

## 1. Purpose

Turn the v1 planning calendar into a **publishing** tool: scheduled posts (and on-demand ones) are
actually posted to the Wahlburgers at Home **Instagram + Facebook** via a third-party publisher, with
the chosen aspect ratio honored, results synced back to the post's status, and failures surfaced.

v1 shipped the calendar/composer/queue/tagging/media/reminders with **no live publishing**. Phase 2 adds
the publishing pipeline. No new calendar UX is introduced beyond publish controls + a settings page.

## 2. Confirmed Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Vendor | **Late/Zernio** (free tier: 1 IG + 1 FB, managed Meta OAuth, native scheduling). |
| Scheduling ownership | **Vendor-owned** — we hand Late/Zernio the content + scheduled time; it publishes at that minute. **No `pg_cron`** (supersedes Gate 0's pg_cron note, which assumed we publish ourselves). |
| Status sync | **Webhook + daily reconcile** — signed vendor webhook updates status in near-real-time; the existing daily cron reconciles any missed events. |
| Account linking | **One-time setup in the vendor dashboard** + API key in env; WahlTools shows read-only connection status on a Social settings page. |
| Publish controls | **Scheduled auto-publish + manual "Publish now."** Marking a post **Scheduled = it will auto-post** at its time (a real live post). |
| Aspect-ratio fidelity | **Pre-crop server-side** (center-crop to the chosen ratio with `sharp`) before sending; `auto` = original; video passed through. |
| Failure alerts | Resend email to the reused **`social_recipients`** on failure; `failed` already renders red. |
| Daily digest | **Repurpose the "overdue" line** to mean "scheduled posts that failed / need attention"; keep the "ideas without a date" nudge. |

## 3. Architecture & Flow

```
Compose → Schedule (valid)        ──► pre-crop images to ratio ──► upload derivatives ──►
  late.schedule({media URLs, caption, platforms, scheduleDate})  ──► store vendorId+croppedPaths in external_ref
Late/Zernio publishes at scheduleDate ──► webhook → /api/webhooks/late ──► status = posted | failed
                                          (daily cron reconcile catches misses)
failed ──► Resend failure email + red on calendar
```

"Publish now" runs the same path with immediate publish instead of a future `scheduleDate`.

## 4. Publishing Adapter — `src/lib/publishing/`

- **`adapter.ts`** — a small `PublishAdapter` interface so a future vendor swap stays localized:
  `schedule(req)`, `publishNow(req)`, `getStatus(vendorId)`, `cancel(vendorId)`. Request type carries
  `{ caption, mediaUrls, mediaType, platforms, scheduleDate? }`; responses carry `{ vendorId, status }`.
- **`late-client.ts`** — the concrete Late/Zernio implementation (typed REST calls), keyed by
  `LATE_API_KEY`, targeting `LATE_PROFILE_ID`. Maps vendor statuses to our `posted`/`failed`/`scheduled`.
- **`rules.ts`** — per-format constraints used by validation + cropping:
  - `image`: exactly 1 image. `carousel`: 2–10 images. `reel`: 1 video. `story`: 1 image or video.
  - Caption max length (per IG limits); `platforms` must be non-empty and a subset of the connected
    networks. These are the gate before any send.
- **`crop.ts`** — `cropImageToRatio(input, ratio)` using **`sharp`**: center-crops an image to the post's
  numeric ratio (from `aspectRatioNumber`); returns a buffer. `auto` → no crop; non-image → skipped.

## 5. Media Pre-Crop Pipeline

On publish, for each image media item:
1. Fetch the original from its public Storage URL.
2. If the post's `aspect_ratio` ≠ `auto`, center-crop to that ratio via `sharp`; else use original.
3. Upload the derivative to `social-media/published/<postId>/<n>.<ext>` (public).
4. Collect the derivative public URLs (in `position` order) to send to the vendor.

Derivative storage paths are recorded in `external_ref.croppedPaths[]`. They're removed **after a
confirmed publish** (cleanup in the webhook/reconcile handler) and on `deleteSocialPost` (extend it to
also remove `croppedPaths`). Videos are sent by their original public URL (no processing in v2).

## 6. Trigger & Lifecycle — `src/app/actions/publish.ts`

- **`publishPost(id, { now }: { now?: boolean })`** — validates via `rules.ts`; on failure returns a
  clear error (UI toasts, status stays `draft`/`idea`, nothing sent). On success: runs the crop
  pipeline, calls `adapter.schedule` (future `scheduled_at`) or `adapter.publishNow` (`now: true` or a
  past/near time), stores `{ vendorId, croppedPaths }` in `external_ref`, sets status `scheduled`.
- **Save-time hook** (in the existing `save_social_post` server-action wrapper, not the RPC): when a save
  results in status `scheduled` with a future `scheduled_at`, call `publishPost`. If the post was already
  sent (has `external_ref.vendorId`), **cancel + re-create** at the vendor (simplest correct path for
  edited content/time). If a previously-scheduled post is moved off `scheduled`, deleted, or rescheduled,
  **cancel** the vendor post first.
- **`reschedulePost`** and **`updatePostStatus`** updated to cancel/re-send at the vendor as needed.
- "Publish now" surfaces in the composer, the calendar right-click menu, and the queue kebab.

## 7. Status Sync

- **`src/app/api/webhooks/late/route.ts`** — verifies the signature with `LATE_WEBHOOK_SECRET`, finds the
  post by `external_ref.vendorId`, maps the event → `posted` (stamps `posted_at`, clears
  `failure_reason`, removes `croppedPaths` from Storage) or `failed` (stores `failure_reason`, triggers
  the failure email), then `revalidatePath`. Uses the service-role admin client (no user session).
- **Daily cron reconcile** — in `api/cron/price-reminder/route.ts`, a new independent block (like the
  social digest) calls `adapter.getStatus` for posts that are `scheduled` with `scheduled_at` in the past
  (or sent within the last N days) and updates any the webhook missed.

## 8. Failure Alerts & Digest Repurpose

- **`src/lib/email/send-publish-failure.ts`** — Resend email (branded shell) to `social_recipients`:
  post name, scheduled time, failure reason, link to the post. Sent from the webhook/reconcile on `failed`.
- **Digest repurpose** — `getUpcomingAndOverduePosts` / the social digest copy change so the "overdue"
  section means **"scheduled posts that failed or are past their time and not posted"** (i.e. need
  attention), keeping the unscheduled-ideas nudge. (Successful auto-posts shouldn't appear as overdue.)

## 9. UI Surface

- **`/dashboard/social/settings`** — `PageContainer` + `PageHeader` + breadcrumbs (Social › Settings).
  Read-only **connection status** (`adapter.getStatus`-style account check → "Connected as
  @wahlburgersathome ✓" or a "Not connected — set up in Late/Zernio" notice) and a clear note that
  **Scheduled posts auto-publish**.
- **Composer** — a **Publish now** button (with a confirm, since it's a live post) and a subtle
  "Will auto-publish on <date/time>" hint when status is Scheduled.
- **Right-click menu + queue kebab** — add **Publish now** (with confirm).
- All surfaces designed for light + dark, using existing primitives + the toast/ConfirmDialog patterns.

## 10. Schema & Config (migration 22)

- **No new core columns** — reuses `status`, `posted_at`, `failure_reason`, `external_ref`.
  `external_ref` JSON shape: `{ "vendorId": string, "croppedPaths": string[] }`.
- Migration 22 (run manually in Supabase): a `published/` prefix needs no schema change (same bucket);
  if any index helps the reconcile query (e.g., partial index on `status='scheduled'`), include it.
  *(If we later store the vendor profile in DB instead of env, add a `social_account` singleton row;
  v2 uses env.)*
- **Env (new):** `LATE_API_KEY`, `LATE_WEBHOOK_SECRET`, `LATE_PROFILE_ID`. Documented in `CLAUDE.md`.
  The webhook route and reconcile use the service-role admin client.

## 11. Build Dependency / Setup

- Add **`sharp`** (image cropping).
- **One-time manual setup (you):** create the Late/Zernio account, connect the IG + FB account in their
  dashboard, generate the API key, configure the webhook URL
  (`https://wahlburgers-price-tracker.vercel.app/api/webhooks/late`) + secret, and set the three env vars
  in Vercel. The build does **not** depend on these; live publishing does.

## 12. Out of Scope (Phase 3+)

Multiple accounts/platforms beyond the one IG + FB; performance/analytics pull-back (reach/likes);
promo-aware post suggestions from price data; auto-pulling product images/live prices into the composer.

## 13. Verification

`pnpm lint` + `pnpm build` pass. Manual: with vendor creds set on the preview — schedule a post a few
minutes out and confirm it posts + flips to `posted`; trigger a failure (e.g. invalid media) and confirm
the `failed` status + email; "Publish now" posts immediately; editing a scheduled post updates the vendor
post; deleting cancels it; settings page shows connection status; light + dark render correctly.

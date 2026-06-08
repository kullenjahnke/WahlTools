# Social Media Calendar — v1 Design Spec

> **Status:** Approved (2026-06-08). Feeds the implementation plan (writing-plans / Gate 2).
> **Branch:** `feature/social-calendar`.
> **Companion docs:** [Gate 0 publishing research & decision](../../social-calendar/gate-0-publishing-research.md).

## 1. Purpose & Phasing

A social-media **content calendar** inside WahlTools where two users plan posts for the Wahlburgers at
Home **Instagram** and **Facebook**. Posts can be tagged to catalog **products** and a **retailer**.

- **Phase 1 (v1 — this build):** calendar + composer + product/retailer tagging + media upload +
  status lifecycle + Resend reminders. **No Meta API, no live publishing.**
- **Phase 2:** real scheduled auto-publishing via a **third-party API** (decision recorded in Gate 0:
  Late/Zernio free tier, Ayrshare paid fallback) + Supabase `pg_cron` scheduling; per-format publishing
  rules; auto-post failure alerts.
- **Phase 3+:** auto-pull product images & live price/promo into the composer; promo-aware suggestions;
  post-performance analytics.

v1 must **never** be blocked on Meta access — the calendar ships regardless. The schema carries
`platforms`, `external_ref`, and `failure_reason` now purely so the Phase-2 upgrade needs no migration.

## 2. Confirmed Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Calendar view | **Month-only** in v1 (Week view deferred). |
| Day-cell rendering | **Thumbnail tiles** (Later-style): media thumb + status-colored left border. |
| Interactions | Click empty day → create; click post → edit; **drag → reschedule** (native HTML5 DnD, with a kebab "Reschedule" fallback). |
| Composer | **Two-pane modal**: fields left, **live IG/FB-style preview** right. Not a separate route. |
| Status lifecycle | `idea → draft → scheduled → posted → failed` (color-coded chips). |
| Platform targeting | Per-post **Instagram and/or Facebook** toggles, default **both on**. |
| Tagging | **Many products + many retailers**, both **optional** (most posts reference no retailer), shown as `Chip`s, **filterable** on calendar + queue. |
| Ideas without a date | Live **only in the Queue**; appear on the calendar once given a `scheduled_at`. |
| Reminders | **Morning-of + overdue** daily digest via existing Resend + daily cron. |
| Media | **Images via server action (≤5MB each)**; **video/reel via direct-to-storage** signed-URL upload (bypasses the 5MB body limit). Full format support in v1. |
| Surfaces | Calendar **+** Queue list. |
| Theming | Every surface designed for **light and dark** per `globals.css` tokens; Inter Tight, `--brand` green, shadcn/ui new-york. |

## 3. Data Model

All tables get RLS `for all to authenticated using (true) with check (true)` — matching the rest of the
app. Timestamps are `timestamptz`; display uses **America/Detroit** (consistent with the app).

### `social_posts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `default gen_random_uuid()` |
| `caption` | text | post copy; nullable for bare ideas |
| `format` | text | check in (`image`,`carousel`,`reel`,`story`); default `image` |
| `status` | text | check in (`idea`,`draft`,`scheduled`,`posted`,`failed`); default `idea` |
| `scheduled_at` | timestamptz null | null = unscheduled idea (Queue only) |
| `posted_at` | timestamptz null | set when marked `posted` |
| `platforms` | text[] | default `{instagram,facebook}`; **CHECK `platforms <@ ARRAY['instagram','facebook']::text[]`** so only allowed values persist; array keeps it open to more platforms (extend the allow-list when adding one) |
| `notes` | text null | internal notes |
| `external_ref` | jsonb null | **Phase-2** vendor post IDs (vendor-agnostic) |
| `failure_reason` | text null | **Phase-2** publish failure detail |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

Indexes: `(scheduled_at)`, `(status)`.

### `social_post_media`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `post_id` | uuid | FK → `social_posts(id)` **on delete cascade** |
| `url` | text | public URL in the `social-media` bucket |
| `storage_path` | text | path used for deletion |
| `media_type` | text | check in (`image`,`video`) |
| `position` | int | carousel ordering; default 0 |
| `created_at` | timestamptz | default `now()` |

Index: `(post_id, position)`.

### `social_post_products` (join)
| Column | Type | Notes |
|---|---|---|
| `post_id` | uuid | FK → `social_posts(id)` on delete cascade |
| `product_id` | uuid | FK → `products(id)` on delete cascade |
| PK | (`post_id`,`product_id`) | |

### `social_post_retailers` (join)
| Column | Type | Notes |
|---|---|---|
| `post_id` | uuid | FK → `social_posts(id)` on delete cascade |
| `retailer` | text | retailer name (value from `RETAILERS` config), stored as text like `prices.retailer` |
| PK | (`post_id`,`retailer`) | |

*(Products and retailers are both 0..n and both optional — symmetric join tables rather than a single
column, so a post can reference multiple of each or none. The vast majority of posts will have no
retailer.)*

### Atomic RPC
`save_social_post(p_post jsonb, p_product_ids uuid[], p_retailers text[], p_media jsonb) RETURNS uuid`
(`SECURITY DEFINER`, mirrors `record_price_check`): upserts the post row (insert when `p_post->>'id'`
is null, else update), then **replaces** the post's product tags, retailer tags, and media rows from the
args — all in one transaction. Returns the post id. The RPC **validates** `p_retailers` against the
allowed retailer set and relies on the `platforms` CHECK for platform validation (belt-and-suspenders
with app-level validation). Media files are uploaded to storage *before* calling the RPC; the RPC only
writes the `social_post_media` rows. Setting `status='posted'` stamps `posted_at`.

### Storage
New **public** bucket **`social-media`**. Storage RLS: `select` public; `insert`/`update`/`delete` for
`authenticated`. **No `next.config.ts` change needed** — the project's Supabase host is already
allow-listed for `/storage/v1/object/public/**`.

## 4. Server Actions — `src/app/actions/social.ts`

Pattern matches existing actions (`createSupabaseServerClient`, try/catch returning
`{ success, error?, data? }`, `revalidatePath`).

- `createSocialPost(input)` / `updateSocialPost(id, input)` → call `save_social_post` RPC (input carries
  `productIds`, `retailers`, and `media`). Validate `platforms` and `retailers` against the config
  allow-lists before the call (the DB CHECK + RPC validation are the backstop).
- `deleteSocialPost(id)` → delete the post's storage objects (by `storage_path`), then delete the row
  (cascade clears media + product joins). `revalidatePath`.
- `reschedulePost(id, scheduledAt)` — single-field update (drag-to-reschedule + kebab fallback).
- `updatePostStatus(id, status)` — single-field update (stamps `posted_at` when → `posted`).
- `uploadSocialImage(file)` — uploads an image to `social-media` (≤5MB), returns `{ url, storage_path }`.
- `createSocialVideoUploadUrl(filename)` — returns a Supabase **signed upload URL** so the browser
  uploads video direct-to-storage; the client then passes the resulting `{ url, storage_path }` into save.

## 5. Routes, Components, Config

### Routes — `src/app/(dashboard)/dashboard/social/`
- `page.tsx` — **month calendar**. Server component fetches posts in the visible month range
  (with media + tags), renders the client calendar. Wrapped in `PageContainer` + `PageHeader`.
- `queue/page.tsx` — **queue list**: filterable by status / product / retailer; includes unscheduled
  ideas. `Breadcrumbs` (Social › Queue). Uses `RowActions` kebab per row.
- Composer is a **client modal** launched from the calendar/queue, deep-linkable via `?post=<id>` /
  `?date=<iso>`.

### Components — `src/components/social/`
`social-calendar.tsx` (month grid + native DnD), `post-tile.tsx` (day-cell tile), `post-composer-dialog.tsx`
(two-pane modal), `post-preview.tsx` (phone-style live preview), `media-dropzone.tsx` (image upload +
video signed-URL upload, carousel ordering), `tag-picker.tsx` (product multi-select + retailer
multi-select, both optional, `Chip` display), `status-chip.tsx` (status → `Chip` tone), `queue-list.tsx`.
Keep files focused and small.

### Config — `src/lib/config/social.ts`
`SOCIAL_STATUSES` (status → label + `Chip` tone class for light/dark), `SOCIAL_FORMATS`
(format → label), `SOCIAL_PLATFORMS` (`instagram`, `facebook` → label + icon). Status tones:
idea = amber, draft = neutral/zinc, scheduled = blue, posted = green, failed = red.

### Navigation
Add **Social** (`/dashboard/social`, lucide `CalendarDays`) to `app-sidebar.tsx` `NAV` and to
`mobile-nav.tsx`, positioned after **Analytics** (before Settings).

## 6. Reminders — `src/lib/email/` + cron

- `reminder-data.ts`: add `getUpcomingAndOverduePosts(admin)` → posts with `scheduled_at` falling on
  **today (America/Detroit)** plus any post still `status='scheduled'` whose `scheduled_at < now()`
  (overdue), with their tags for display.
- New `send-social-reminder.ts` + template (reuse the branded `shell.ts`): a digest listing today's and
  overdue posts with status, time, format, and product/retailer tags, linking to `/dashboard/social`.
- Cron route (`api/cron/price-reminder/route.ts`): add the social-digest send as a **distinct, clearly
  separated code path** from the weekday-gated price/follow-up/N-A logic — its own `try/catch` block and
  its own `actions.social` result key. It runs **every day** (morning-of), gated only on
  `social_reminder_enabled` and there being posts to report; sent to `social_recipients`. It must not
  share or depend on the `weekday === settings.weekly_day` gating. (If the digest later wants its own
  send hour, that's a Phase-2 concern once sub-daily cron exists.)
- `18_extend_reminder_settings_social.sql`: add `social_reminder_enabled boolean default true` and
  `social_recipients text[]`. Surface a **Social** section on the Reminders settings page + extend
  `settings.ts` (`ReminderSettings` type, defaults, parsers) and `reminders.ts` save action.

## 7. Types & Migrations

- `src/types/database.ts`: add `social_posts`, `social_post_media`, `social_post_products`,
  `social_post_retailers` (Row/Insert/Update).
- Numbered migrations (run **manually in the Supabase SQL editor** — note this in the plan and the
  migration headers): **`16_social_calendar.sql`** (tables + indexes + RLS + `save_social_post` RPC),
  **`17_social_media_bucket.sql`** (bucket + storage policies), **`18_extend_reminder_settings_social.sql`**.

## 8. Out of Scope (v1)

Meta Graph API / third-party publishing; sub-daily scheduling; per-format publishing rules; auto-post
failure alerts; auto-pulling product images or live price/promo into the composer; performance analytics;
Week/Day calendar views; multi-account UI. (Most are Phase 2/3 per §1.)

## 9. Verification

`pnpm lint` and `pnpm build` pass. Manual smoke via the preview tools: create an idea, add media + tags,
schedule it (appears on calendar), drag to reschedule, change status, see it in the queue, and confirm
both light and dark render correctly. Reminder send verified via the existing test-send path.

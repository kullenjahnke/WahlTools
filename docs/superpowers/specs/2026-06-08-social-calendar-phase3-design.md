# Social Calendar — Phase 3 Design Spec (umbrella)

> **Status:** Approved (2026-06-08). Umbrella spec for five independent sub-features.
> **Execution model:** each sub-feature gets its **own implementation plan + build session** (fresh
> context), in the value order A → B → C → D → E. The shared `social_settings` table + migrations land
> with the first feature that needs them (A).
> **Builds on:** v1 ([2026-06-08-social-calendar-design.md](2026-06-08-social-calendar-design.md)) +
> Phase 2 ([2026-06-08-social-calendar-phase2-publishing-design.md](2026-06-08-social-calendar-phase2-publishing-design.md)).

> **Status update — 2026-06-09 (Feature A shipped, PR #10 squash-merged to `main`):**
> AI captions + the `social_settings` table are live. Deltas from this umbrella spec for the B–E sessions:
> - **`social_settings` is fully created** (migration `23_social_settings.sql`: `brand_voice`,
>   `caption_model` default `'claude-haiku'`, `asset_retention_days` default 30, `analytics_enabled`
>   default true; id=1 singleton + RLS). **C (analytics)** and **E (asset cleanup)** do **not** need a new
>   migration for these columns — they wire up the existing ones.
> - **Settings UI + `saveSocialSettings` currently handle only `brand_voice` + `caption_model`.** The §0
>   "Settings UI" items for **Asset retention (days)** (E) and **Analytics on/off** (C) were intentionally
>   deferred — those features must **extend** `src/components/social/social-settings-form.tsx` and the
>   `saveSocialSettings` action (`src/app/actions/social-settings.ts`), which today persist only those two
>   fields.
> - **The `social_posts` column additions did NOT land with A** (despite §0 saying they would; scope was
>   trimmed to A-only). `collaborators text[]` lands with **B**; `metrics jsonb` + `metrics_synced_at
>   timestamptz` land with **C**.
> - **Next free migration number is `24`.**
> - **Reusable artifacts now in place:** `getSocialSettings` / `saveSocialSettings`
>   (`src/app/actions/social-settings.ts`), `src/lib/config/social-settings.ts` (defaults,
>   `normalizeSocialSettings`, `CAPTION_MODELS`, `resolveCaptionModelId`), the lazy Anthropic client
>   (`src/lib/ai/anthropic.ts`), and `generateCaption` (`src/app/actions/ai.ts`). `caption_model` is a
>   label resolved to a concrete model id in config — keep the model ids current there.

## 0. Shared groundwork (lands with Feature A)

- **New `social_settings` singleton table** (mirrors `reminder_settings`; id=1 check), columns:
  - `brand_voice text` — editable brand-voice/style guidance for AI captions.
  - `caption_model text not null default 'claude-haiku'` — which Claude model to use (label resolved
    to a concrete model id in config; configurable so we can switch tiers).
  - `asset_retention_days int not null default 30` — Feature E retention (0 = never delete).
  - `analytics_enabled boolean not null default true` — Feature C toggle.
  - RLS `for all to authenticated using (true) with check (true)`; seed one row.
- **`social_posts` column additions** (one migration; columns are nullable/defaulted so they're additive):
  - `collaborators text[] not null default '{}'` — Feature B.
  - `metrics jsonb` + `metrics_synced_at timestamptz` — Feature C.
- **Settings UI:** the existing `/dashboard/social/settings` page (Phase 2) gains editable **Brand voice**
  (textarea) + **Asset retention (days)** + **Analytics on/off**, saved via a new `saveSocialSettings`
  action. A `social_settings` accessor (`getSocialSettings`) + `src/lib/config/social-settings.ts`
  (defaults/normalizer, like `email/settings.ts`).
- Migrations are numbered (next free numbers, e.g. `23_…`) and **run manually in the Supabase SQL editor**.

## A. AI caption generation

**Goal:** generate an on-brand caption from a post idea.

- **Dep/env:** add `@anthropic-ai/sdk`; new env `ANTHROPIC_API_KEY` (documented in CLAUDE.md). A lazy
  client in `src/lib/ai/anthropic.ts` (mirrors `email/resend.ts`'s lazy pattern).
- **Server action** `generateCaption({ title, notes, productNames, retailers })` in
  `src/app/actions/ai.ts`: builds a prompt = editable **brand voice** (from `social_settings`) as the
  system prompt + the **idea context** (title + internal notes + tagged product names + retailers) as
  the user message; calls Claude (model from settings); returns `{ success, caption }`. Caps output
  length (~caption-appropriate), strips surrounding quotes. Never auto-publishes.
- **Composer UI:** a **"Generate caption"** button near the caption field (with a small spinner). On
  click it calls the action with the current title/notes/tags and fills the caption (editable);
  a **"Regenerate"** affordance produces an alternative. If brand voice is unset, still works (generic),
  with a hint to set brand voice in Settings.
- **Idea context = title + notes + product/retailer tags** (confirmed). Cost is negligible (short
  outputs on Haiku). Errors surface as a destructive toast; the field is never overwritten on failure.

## B. Collaborators + @mentions

**Goal:** invite IG collaborators (e.g. Shaw's) and reference accounts (e.g. Chef Paul).

- **Data:** `social_posts.collaborators text[]` (usernames, no leading `@`, max 3 enforced in the action).
- **Composer UI:** a **Collaborators** chip-input (shown when Instagram is a target; up to 3 usernames),
  rendered as `Chip`s; persisted via the existing save path (extend `SocialPostInput` + the
  `save_social_post` RPC to accept `collaborators`). Collaborators also show as chips on the tile/queue.
- **Publish mapping (Phase 2 client):** in `zernio-client` `buildBody`, when the post has collaborators
  and Instagram is targeted, add them to the Instagram `platformSpecificData.collaborators` (Zernio caps
  at 3; Business/Creator usernames only). Facebook ignores collaborators.
- **@mentions:** plain caption text (`@username`) — no special handling (Zernio doesn't auto-create
  mentions; they render as typed). The AI caption prompt may include mentions when relevant.
- **Out of scope:** in-image photo tagging with x/y coordinates (deferred — needs a coordinate picker).

## C. Analytics pull-back

**Goal:** show real engagement on posted items.

- **Adapter:** extend the publishing layer with `getAnalytics(vendorId)` → normalized
  `{ likes, comments, reach, impressions, engagementRate, syncStatus, lastUpdated }` via Zernio
  `GET /v1/analytics?postId=<vendorId>` (per-post). FB has **no per-post reach** (Meta limitation) —
  store null and render "—".
- **Daily cron block** (independent, like the reconcile): for posts with `status='posted'` and
  `posted_at` within the last ~30 days, fetch analytics (respect the ~60-min cache and free-tier
  2 req/sec — use the **batched list** `GET /v1/analytics?fromDate&toDate` rather than one call per post),
  write `metrics` + `metrics_synced_at`. Gated on `social_settings.analytics_enabled`. Handles
  `syncStatus: pending` (up to ~48h after publish) by leaving metrics null and retrying next day.
- **UI:** posted tiles + queue rows show compact headline numbers (e.g. `♥ 342 · 💬 28`); the composer
  (edit mode, posted) shows a small metrics block (likes/comments/reach/impressions/engagement) with a
  "synced <relative time>" note, or "Metrics pending" when not yet available.
- **No new vendor cost** (analytics is on the free tier).

## D. Quick-idea affordance

**Goal:** let Ryan drop image-less ideas fast.

- Image-less ideas already save (validation never requires media). This adds a **lightweight quick-add**:
  a **"Quick idea"** popover/dialog opened from a header button (and optionally a day cell's "+"):
  fields = **title**, **notes**, **date** (optional), status fixed to **Idea**, no media/format/platform
  pickers. Saves via the existing `createSocialPost` (format defaults to `image`, platforms default,
  media empty). The full composer remains for adding media/scheduling later.
- Keep it a small focused client component (`quick-idea-dialog.tsx`); reuse `ConfirmDialog`-style
  patterns and toasts. Calendar create-click can offer both "Quick idea" and "Full composer."

## E. Asset auto-cleanup

**Goal:** conserve Supabase storage + keep the app fast.

- **Daily cron block** (independent): for posts with `status='posted'` and `posted_at <
  now - asset_retention_days` (default **30**; `0` disables), delete the original media **storage
  objects** and their `social_post_media` rows. Cropped publish derivatives are already removed at
  publish time. Live IG/FB copies are untouched (the vendor hosts them).
- **Effect:** those old posted tiles fall back to a **format icon** (no thumbnail). Irreversible;
  posted-only; never touches idea/draft/scheduled posts.
- **Settings:** `asset_retention_days` editable on the Social settings page; the page also surfaces a
  short "check Supabase → Storage for current usage" note.
- **Order:** built last (lowest urgency — storage is not a near-term constraint per the investigation:
  ~100 MB/yr for images on the current cadence vs. 1 GB free / 100 GB Pro).

## Out of scope / separate track (Ryan's Prices & Analytics ideas)

These are a **different domain** and will be designed/built on their own track, not in Phase 3:

- **Prices quick wins:** default the Freshness filter to **Fresh** (one-line: `retailer-price-table.tsx`
  `useState<FreshnessFilter>` default), and **remove HyVee from the Prices table** (HyVee is *not* in the
  9-retailer config — it appears via stray `retailer='HyVee'` price data; needs a DB cleanup +
  exclusion, confirmed Ryan sees it on the Prices page).
- **Analytics chart-export image:** export a stylized PNG/JPG of a product's price chart + retailer
  metrics (with applied settings) including the product image, title, and a "Powered by WahlTools" logo.
  Own design pass.
- **Prior-week price entry/adjustment:** add/adjust a product's price at any retailer for a past week
  (touches the price-history active/historical model + `record_price_check` RPC). Own design pass.

## Phasing summary

| Feature | Effort | Order | New dep/env | Migration |
|---|---|---|---|---|
| A. AI captions | Medium | 1 | `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` | `social_settings` (+ groundwork) |
| B. Collaborators | Small | 2 | — | `collaborators` column + RPC update |
| C. Analytics | Medium | 3 | — | `metrics`/`metrics_synced_at` columns |
| D. Quick-idea | Small | 4 | — | none |
| E. Asset cleanup | Small | 5 | — | none (cron + settings only) |

## Verification (per feature)

`pnpm lint` + `pnpm build` each. Manual smoke per feature (A: generate a caption from an idea; B:
add collaborators, confirm they reach Zernio on publish; C: confirm metrics appear on a posted post;
D: quick-add an idea; E: confirm an old posted post's assets are removed after the retention window).
Light + dark on every new surface.

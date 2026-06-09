# Social Asset Auto-Cleanup (Phase 3, Feature E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conserve Supabase storage by deleting the original media (storage objects + `social_post_media` rows) of `posted` posts older than a configurable retention window, via a block piggybacked on the existing daily cron, with the retention window editable on the Social settings page.

**Architecture:** No migration — `social_settings.asset_retention_days` already exists (migration 23, default 30). Three changes: (1) extend `saveSocialSettings` to persist `asset_retention_days` with validation; (2) add an "Asset retention (days)" number input to the settings form; (3) add a self-contained `cleanupOldPostedAssets(admin, retentionDays)` helper and call it from the existing `/api/cron/price-reminder` route, gated on `retention_days > 0`, using the service-role admin client. Cleanup is irreversible and **posted-only** — never touches idea/draft/scheduled posts. Cropped publish derivatives are already removed at publish/reconcile time (don't double-handle); live IG/FB copies are vendor-hosted and untouched.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict), Supabase (`@supabase/supabase-js` service-role admin client), Supabase Storage (bucket `social-media`), shadcn/ui (Input/Label), Tailwind (light + dark). **No test runner** — verify every task with `pnpm lint` + `pnpm build` and a careful manual smoke against a single deliberately-old posted post (never production data).

---

## Design decisions (pinned)

| Decision | Choice |
|---|---|
| Storage bucket | `'social-media'` (confirmed: cron route already removes cropped paths from it — `route.ts:105`) |
| Storage object key column | `social_post_media.storage_path` (confirmed: `src/types/database.ts:115`) |
| Delete `social_post_media` rows? | **Yes** — delete both the storage objects and the rows (per spec §E). Tiles then fall back to the format icon. |
| "Older than N days" boundary | Absolute UTC instant: `cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString()`; select `posted_at < cutoff` (strictly older). DST-immune; mirrors the reconcile block's `Date.now() - 5*60*1000` pattern. |
| Per-run batch cap | `MAX_CLEANUP_POSTS = 200` posts per invocation. Count eligible posts separately; **log eligible vs. processed** so truncation is never silent. Daily cron + ~100 MB/yr growth means 200/day is ample headroom. |
| `asset_retention_days` validation | Coerce to integer, clamp to `[0, 3650]`. `0` disables cleanup entirely. Default 30. |
| Cron settings read | Direct `admin.from('social_settings')...maybeSingle()` + `normalizeSocialSettings` (NOT `getSocialSettings`, which calls `auth.getUser()` and returns defaults with no signed-in user). |
| Tile fallback | No code change — `post-tile.tsx:43-47` already renders the format `Icon` when `post.media[0]` is absent. Verified during smoke. |

---

## File Structure

- **Create:** `src/lib/social/asset-cleanup.ts` — self-contained `cleanupOldPostedAssets(admin, retentionDays)` helper. One responsibility: find posted posts past the retention window (capped), remove their storage objects, delete their media rows, and return a summary. Co-located with the other `src/lib/social/*` query helpers.
- **Modify:** `src/app/actions/social-settings.ts` — extend `saveSocialSettings` input + validation to persist `asset_retention_days`; add a `clampRetentionDays` validator.
- **Modify:** `src/components/social/social-settings-form.tsx` — add the "Asset retention (days)" number input + helper note; thread the value into `saveSocialSettings`.
- **Modify:** `src/app/api/cron/price-reminder/route.ts` — add an asset-cleanup block after the reconcile block, gated on `retention_days > 0`.

---

### Task 1: Persist `asset_retention_days` in `saveSocialSettings`

**Files:**
- Modify: `src/app/actions/social-settings.ts`

The accessor already returns `asset_retention_days` (via `normalizeSocialSettings`), so only the writer needs extending.

- [ ] **Step 1: Add a clamp validator and extend the action input/upsert**

In `src/app/actions/social-settings.ts`, replace the `saveSocialSettings` function (and its preceding comment, currently lines 36–71) with:

```typescript
/** Coerce arbitrary input into a valid retention window: integer in [0, 3650] (0 = never delete). */
function clampRetentionDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SOCIAL_SETTINGS.asset_retention_days
  return Math.min(3650, Math.max(0, Math.floor(n)))
}

// Persists brand_voice + caption_model (Feature A) and asset_retention_days
// (Feature E). analytics_enabled keeps its DB default until Feature C wires it up.
export async function saveSocialSettings(input: {
  brand_voice: string
  caption_model: string
  asset_retention_days: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in to save.' }

  const caption_model = CAPTION_MODEL_VALUES.includes(input.caption_model)
    ? input.caption_model
    : DEFAULT_SOCIAL_SETTINGS.caption_model
  const brand_voice = (input.brand_voice ?? '').slice(0, 4000)
  const asset_retention_days = clampRetentionDays(input.asset_retention_days)

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.from('social_settings').upsert({
      id: 1,
      brand_voice,
      caption_model,
      asset_retention_days,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    revalidatePath('/dashboard/social/settings')
    return { success: true }
  } catch (error) {
    console.error('saveSocialSettings failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings.',
    }
  }
}
```

- [ ] **Step 2: Verify lint + types/build**

Run: `pnpm lint && pnpm build`
Expected: PASS, no errors. (`build` will surface the type mismatch at the form's `saveSocialSettings(...)` call — that call site is updated in Task 2; if you build Task 1 in isolation, expect a type error at `social-settings-form.tsx` until Task 2 lands. Run the build after Task 2 for a clean pass, or temporarily expect that one call-site error.)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/social-settings.ts
git commit -m "feat(social): persist asset_retention_days in saveSocialSettings"
```

---

### Task 2: Add the "Asset retention (days)" settings input

**Files:**
- Modify: `src/components/social/social-settings-form.tsx`

- [ ] **Step 1: Confirm the Input primitive exists**

Run: `ls src/components/ui/input.tsx`
Expected: the file exists (shadcn `Input`). If it does not, use a plain `<input className="...">` styled to match the form (Task 3 of this file is unaffected either way).

- [ ] **Step 2: Add the retention state, input field, and thread it into save**

In `src/components/social/social-settings-form.tsx`:

Add the `Input` import alongside the existing `Label` import (after line 7):

```typescript
import { Input } from '@/components/ui/input'
```

Add retention state after the `captionModel` state (currently line 17):

```typescript
  const [retentionDays, setRetentionDays] = useState(String(initial.asset_retention_days))
```

Update the `handleSave` call (currently line 23) to include the parsed value:

```typescript
    const res = await saveSocialSettings({
      brand_voice: brandVoice,
      caption_model: captionModel,
      asset_retention_days: Number(retentionDays) || 0,
    })
```

Add the new field block immediately after the "Caption model" `<div className="space-y-2">…</div>` block (i.e. after the closing `</div>` on line 62, before the save-button `<div className="flex justify-end">`):

```tsx
      <div className="space-y-2 border-t border-border pt-5">
        <h2 className="text-sm font-semibold">Asset cleanup</h2>
        <Label htmlFor="asset-retention-days">Asset retention (days)</Label>
        <Input
          id="asset-retention-days"
          type="number"
          inputMode="numeric"
          min={0}
          max={3650}
          step={1}
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          className="max-w-[8rem]"
        />
        <p className="text-xs text-muted-foreground">
          Old posted media is deleted after this many days (0 = never delete) — check
          Supabase &rarr; Storage for current usage. Only affects posted items; ideas,
          drafts, and scheduled posts are never touched.
        </p>
      </div>
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS, no errors (this also clears the Task 1 call-site type check).

- [ ] **Step 4: Manual smoke — settings field (light + dark)**

Run: `pnpm dev`, open `http://localhost:3000/dashboard/social/settings`.
Expected: the "Asset retention (days)" number input renders with the helper note, in both light and dark mode. Change it (e.g. to `1`), click **Save**, see the success toast, reload, and confirm the value persisted. Set it back to `30` (or your test value) before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/social/social-settings-form.tsx
git commit -m "feat(social): add asset retention (days) field to social settings"
```

---

### Task 3: Cleanup helper `cleanupOldPostedAssets`

**Files:**
- Create: `src/lib/social/asset-cleanup.ts`

- [ ] **Step 1: Write the helper**

Create `src/lib/social/asset-cleanup.ts` with exactly:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

/** Storage bucket holding social media originals (same bucket cropped derivatives use). */
const SOCIAL_MEDIA_BUCKET = 'social-media'
/** Max posted posts cleaned per cron invocation. Logged vs. eligible so truncation is never silent. */
const MAX_CLEANUP_POSTS = 200
const MS_PER_DAY = 86_400_000

export interface CleanupSummary {
  eligible: number
  processedPosts: number
  removedObjects: number
  deletedRows: number
  capped: boolean
}

/**
 * Delete the original media of posted posts older than the retention window.
 *
 * Safety: posted-only. Never touches idea/draft/scheduled posts. Cropped publish
 * derivatives are already removed at publish/reconcile time, and live IG/FB copies
 * are vendor-hosted, so neither is handled here. Irreversible — callers gate on
 * retentionDays > 0 (0 disables cleanup entirely).
 *
 * Boundary is an absolute UTC instant: posts whose posted_at is strictly older than
 * (now - retentionDays * 24h).
 */
export async function cleanupOldPostedAssets(
  admin: SupabaseClient,
  retentionDays: number
): Promise<CleanupSummary> {
  const empty: CleanupSummary = { eligible: 0, processedPosts: 0, removedObjects: 0, deletedRows: 0, capped: false }
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return empty

  const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY).toISOString()

  // Count eligible posts up front so a capped run is logged, not silently truncated.
  const { count: eligibleCount, error: countError } = await admin
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('posted_at', 'is', null)
    .lt('posted_at', cutoff)
  if (countError) throw countError
  const eligible = eligibleCount ?? 0
  if (eligible === 0) return empty

  // Fetch up to the cap (oldest first), then collect their media.
  const { data: posts, error: postsError } = await admin
    .from('social_posts')
    .select('id')
    .eq('status', 'posted')
    .not('posted_at', 'is', null)
    .lt('posted_at', cutoff)
    .order('posted_at', { ascending: true })
    .limit(MAX_CLEANUP_POSTS)
  if (postsError) throw postsError

  const postIds = (posts ?? []).map((p) => (p as { id: string }).id)
  if (postIds.length === 0) return { ...empty, eligible }

  const { data: media, error: mediaError } = await admin
    .from('social_post_media')
    .select('storage_path')
    .in('post_id', postIds)
  if (mediaError) throw mediaError

  const paths = (media ?? [])
    .map((m) => (m as { storage_path: string | null }).storage_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  let removedObjects = 0
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from(SOCIAL_MEDIA_BUCKET).remove(paths)
    if (removeError) {
      // Storage failure shouldn't abort row cleanup, but surface it for visibility.
      console.error('asset cleanup: storage remove failed:', removeError)
    } else {
      removedObjects = paths.length
    }
  }

  // Delete the media rows so tiles fall back to the format icon.
  const { error: deleteError, count: deletedRows } = await admin
    .from('social_post_media')
    .delete({ count: 'exact' })
    .in('post_id', postIds)
  if (deleteError) throw deleteError

  return {
    eligible,
    processedPosts: postIds.length,
    removedObjects,
    deletedRows: deletedRows ?? 0,
    capped: eligible > postIds.length,
  }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS. (The helper is exported but not yet imported; that's fine — it's wired in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/social/asset-cleanup.ts
git commit -m "feat(social): add cleanupOldPostedAssets storage/media helper"
```

---

### Task 4: Wire the cleanup block into the daily cron

**Files:**
- Modify: `src/app/api/cron/price-reminder/route.ts`

- [ ] **Step 1: Import the helper and the social-settings normalizer**

In `src/app/api/cron/price-reminder/route.ts`, add these imports after the existing import block (after line 10):

```typescript
import { cleanupOldPostedAssets } from "@/lib/social/asset-cleanup"
import { normalizeSocialSettings } from "@/lib/config/social-settings"
```

- [ ] **Step 2: Add the cleanup block**

Insert this block immediately before the final `return NextResponse.json(...)` (currently line 121), after the reconcile `try/catch`:

```typescript
  // Asset cleanup: delete original media of posted posts older than the retention
  // window (social_settings.asset_retention_days; 0 disables). Posted-only,
  // irreversible. Cropped derivatives + vendor-hosted copies are untouched.
  try {
    const { data: socialRow } = await admin
      .from("social_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
    const social = normalizeSocialSettings(socialRow as Parameters<typeof normalizeSocialSettings>[0])
    if (social.asset_retention_days > 0) {
      const summary = await cleanupOldPostedAssets(admin, social.asset_retention_days)
      if (summary.processedPosts > 0 || summary.capped) {
        console.log("asset cleanup:", JSON.stringify(summary))
        actions.assetCleanup = summary
      }
    }
  } catch (error) {
    console.error("asset cleanup failed:", error)
    actions.assetCleanupError = true
  }
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS, no errors.

- [ ] **Step 4: Manual smoke — single deliberately-old posted post (NEVER production data)**

This is irreversible, so test against one post you create/mark for the purpose, locally or in a non-production Supabase project.

1. In the Supabase SQL editor (test project), pick or insert one `posted` post with at least one `social_post_media` row pointing at a real object in the `social-media` bucket, and back-date it:
   ```sql
   update social_posts set posted_at = now() - interval '40 days', status = 'posted' where id = '<test-post-id>';
   ```
2. Set a short retention on the settings page (e.g. `30`) and Save.
3. Trigger the cron locally:
   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/price-reminder
   ```
   Expected: `200`, JSON body includes `"assetCleanup": { "eligible": N, "processedPosts": …, "removedObjects": …, "deletedRows": …, "capped": false }`, and the server log prints the same summary.
4. Verify in Supabase: the test post's `social_post_media` rows are gone and the object(s) are removed from the `social-media` bucket. The `social_posts` row itself remains `posted` (only media is cleaned).
5. Verify safety: an `idea`/`draft`/`scheduled` post with media, and a `posted` post **inside** the window, are both untouched.
6. Open the calendar — the cleaned post's tile now shows the **format icon** (no thumbnail), in light and dark (`post-tile.tsx:43-47` fallback; no code change needed).
7. Set `asset_retention_days = 0`, re-trigger the cron, and confirm the response has **no** `assetCleanup` key (cleanup disabled).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/price-reminder/route.ts
git commit -m "feat(social): run posted-asset cleanup in the daily cron"
```

---

## Self-Review

**Spec coverage (§E + §0 status callout):**
- Daily cron block, posted-only, `posted_at < now - retention`, `0` disables → Task 4 (gate) + Task 3 (helper).
- Delete original storage objects from `social-media` + `social_post_media` rows via admin client → Task 3.
- Read `asset_retention_days` via existing settings → Task 4 reads `social_settings` with `normalizeSocialSettings` (cron has no auth user, so direct admin read, not `getSocialSettings`).
- Cropped derivatives / vendor copies untouched → documented; helper only touches `social_post_media.storage_path`.
- Settings UI number input (0 = never), validate ≥ 0, helper note → Tasks 1 + 2.
- Tile falls back to format icon → verified, no change (`post-tile.tsx`).
- Light + dark on the new field → Task 2 Step 4.
- No new migration, no new env var → confirmed (uses migration 23 column + existing `SUPABASE_SERVICE_ROLE_KEY`).
- Batch cap + logged count, no silent truncation → `MAX_CLEANUP_POSTS` + `eligible` vs `processedPosts` + `capped` flag, logged.

**Placeholder scan:** none — all steps contain concrete code/commands.

**Type consistency:** `saveSocialSettings` input gains `asset_retention_days: number` (Task 1) and the form passes it (Task 2). `cleanupOldPostedAssets(admin, retentionDays)` and `CleanupSummary` defined in Task 3 are imported/used identically in Task 4. `normalizeSocialSettings` already returns `asset_retention_days: number`.

**Verification note:** No test runner exists in this repo (per CLAUDE.md / user instructions) — TDD test steps are intentionally replaced with `pnpm lint` + `pnpm build` + manual smoke. Deletion is irreversible, so the smoke runs against one deliberately-old post, never production data.

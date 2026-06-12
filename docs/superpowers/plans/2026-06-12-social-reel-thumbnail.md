# A3 — Reel Thumbnail (cover-crop + custom cover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Instagram reels a clean, undistorted 9:16 cover — auto-captured from the video's first frame by default, with an optional custom cover upload that overrides it — delivered via Zernio's `instagramThumbnail`.

**Architecture:** Persist a cover reference on `social_posts` (migration 26). The composer captures the first frame client-side (or accepts a custom upload) and stores the cover. At publish, the server cover-crops the active cover to 1080×1920 and sends it as `platformSpecificData.instagramThumbnail` for Instagram reels.

**Tech Stack:** Next.js 15 / React 19, Supabase (Postgres + Storage), sharp (server crop), HTML canvas (client frame capture). No test runner — verification is `pnpm lint` + `pnpm build` plus manual smoke on the deployed build.

---

## Note on verification

No unit-test runner. Each task's gate is `pnpm lint` + `pnpm build` (both clean). The DB migration is
applied manually in the Supabase SQL Editor before live smoke. Design any UI for **both light and dark**.

## File Structure

- **Create** `migrations/26_social_reel_cover.sql` — cover columns + updated `save_social_post`.
- **Modify** `src/app/actions/social.ts` — `SocialPostInput` cover fields; `persist()` payload; `duplicateSocialPost` cover copy.
- **Modify** `src/lib/social/queries.ts` — select + types so edit-load restores the cover.
- **Modify** `src/types/database.ts` — add the three columns to the `social_posts` row type (type accuracy).
- **Modify** `src/lib/publishing/crop.ts` — `cropCover` helper.
- **Modify** `src/lib/publishing/adapter.ts` — `PublishRequest.instagramThumbnailUrl`.
- **Modify** `src/lib/publishing/zernio-client.ts` — send `instagramThumbnail` for IG.
- **Modify** `src/lib/publishing/publish-service.ts` — select cover, crop, set thumbnail URL.
- **Create** `src/lib/social/video-cover.ts` — client `captureFirstFrame`.
- **Modify** `src/components/social/media-dropzone.tsx` — `onVideoSelected` callback.
- **Create** `src/components/social/reel-cover-field.tsx` — cover UI (reel only).
- **Modify** `src/components/social/post-composer-dialog.tsx` — cover state, capture, save/publish payload, render field.
- **Modify** `src/components/social/post-preview.tsx` — show cover for reels.

Order: Task 1 (data layer) → Task 2 (server publish) → Task 3 (client capture) → Task 4 (composer UX).

---

## Task 1: Migration + persistence (data layer)

**Files:** Create `migrations/26_social_reel_cover.sql`; modify `src/app/actions/social.ts`, `src/lib/social/queries.ts`, `src/types/database.ts`.

- [ ] **Step 1: Write the migration**

Create `migrations/26_social_reel_cover.sql` with exactly this content (columns + the full
`save_social_post` replacement, which is migration 24's function plus the three cover fields):

```sql
-- A3 (Reel thumbnail): add reel cover columns to social_posts and teach
-- save_social_post to persist them. The active cover is either an auto-captured
-- first frame (is_custom=false) or a user-uploaded image (is_custom=true).
-- Non-destructive. Run manually in the Supabase SQL editor.

alter table social_posts
  add column if not exists reel_cover_path text,
  add column if not exists reel_cover_url text,
  add column if not exists reel_cover_is_custom boolean not null default false;

create or replace function save_social_post(
  p_post jsonb,
  p_product_ids uuid[],
  p_retailers text[],
  p_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_status := coalesce(p_post->>'status', 'idea');

  if (p_post->>'id') is null then
    insert into social_posts (title, caption, format, status, scheduled_at, posted_at, platforms, notes, aspect_ratio, collaborators, reel_cover_path, reel_cover_url, reel_cover_is_custom)
    values (
      nullif(p_post->>'title',''),
      nullif(p_post->>'caption',''),
      coalesce(p_post->>'format','image'),
      v_status,
      nullif(p_post->>'scheduled_at','')::timestamptz,
      case when v_status = 'posted' then now() else nullif(p_post->>'posted_at','')::timestamptz end,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        array['instagram','facebook']::text[]
      ),
      nullif(p_post->>'notes',''),
      coalesce(p_post->>'aspect_ratio','auto'),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]
      ),
      nullif(p_post->>'reel_cover_path',''),
      nullif(p_post->>'reel_cover_url',''),
      coalesce((p_post->>'reel_cover_is_custom')::boolean, false)
    )
    returning id into v_id;
  else
    v_id := (p_post->>'id')::uuid;
    update social_posts set
      title = nullif(p_post->>'title',''),
      caption = nullif(p_post->>'caption',''),
      format = coalesce(p_post->>'format','image'),
      status = v_status,
      scheduled_at = nullif(p_post->>'scheduled_at','')::timestamptz,
      posted_at = case
        when v_status = 'posted' and posted_at is null then now()
        when v_status <> 'posted' then null
        else posted_at end,
      platforms = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        platforms),
      notes = nullif(p_post->>'notes',''),
      aspect_ratio = coalesce(p_post->>'aspect_ratio','auto'),
      collaborators = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]),
      reel_cover_path = nullif(p_post->>'reel_cover_path',''),
      reel_cover_url = nullif(p_post->>'reel_cover_url',''),
      reel_cover_is_custom = coalesce((p_post->>'reel_cover_is_custom')::boolean, false),
      updated_at = now()
    where id = v_id;
  end if;

  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    if exists (
      select 1 from unnest(p_retailers) r
      where r not in ('Jewel-Osco','Stop & Shop','Acme','Shaws','Giant Eagle',
                      'Giant Food Stores','Big Y','Publix','Safeway')
    ) then
      raise exception 'Invalid retailer in %', p_retailers;
    end if;
  end if;

  delete from social_post_products where post_id = v_id;
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into social_post_products (post_id, product_id)
    select v_id, pid from unnest(p_product_ids) pid
    on conflict do nothing;
  end if;

  delete from social_post_retailers where post_id = v_id;
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    insert into social_post_retailers (post_id, retailer)
    select v_id, r from unnest(p_retailers) r
    on conflict do nothing;
  end if;

  delete from social_post_media where post_id = v_id;
  if p_media is not null and jsonb_array_length(p_media) > 0 then
    insert into social_post_media (post_id, url, storage_path, media_type, position)
    select
      v_id,
      elem->>'url',
      elem->>'storage_path',
      coalesce(elem->>'media_type','image'),
      coalesce((elem->>'position')::int, 0)
    from jsonb_array_elements(p_media) elem;
  end if;

  return v_id;
end;
$$;
```

- [ ] **Step 2: Extend `SocialPostInput` and the `persist()` RPC payload**

In `src/app/actions/social.ts`, add to the `SocialPostInput` interface (after `media`):

```ts
  reel_cover_path?: string | null
  reel_cover_url?: string | null
  reel_cover_is_custom?: boolean
```

In `persist()`, add to the `p_post` object (after `notes`):

```ts
      reel_cover_path: input.reel_cover_path ?? null,
      reel_cover_url: input.reel_cover_url ?? null,
      reel_cover_is_custom: input.reel_cover_is_custom ?? false,
```

- [ ] **Step 3: Carry the cover through `duplicateSocialPost`**

In `src/app/actions/social.ts` `duplicateSocialPost`: add the cover columns to the select string and the `Src` type, copy the cover file to a fresh path, and pass the cover fields to the RPC.

Select string — add `reel_cover_path, reel_cover_url, reel_cover_is_custom,` (e.g. after `collaborators,`):

```ts
      'title, caption, format, platforms, aspect_ratio, notes, collaborators, reel_cover_path, reel_cover_url, reel_cover_is_custom, ' +
```

`Src` type — add:

```ts
    reel_cover_path: string | null
    reel_cover_url: string | null
    reel_cover_is_custom: boolean
```

After the media copy loop (before building `baseLabel`), copy the cover file if present:

```ts
  // Copy the reel cover to a fresh path so deleting one post never removes the other's cover.
  let coverPath: string | null = null
  let coverUrl: string | null = null
  if (src.reel_cover_path) {
    const ext = src.reel_cover_path.split('.').pop() || 'jpg'
    const newCoverPath = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
    const { error: cErr } = await supabase.storage.from(BUCKET).copy(src.reel_cover_path, newCoverPath)
    if (!cErr) {
      coverPath = newCoverPath
      coverUrl = supabase.storage.from(BUCKET).getPublicUrl(newCoverPath).data.publicUrl
    }
  }
```

In the duplicate's `save_social_post` `p_post`, add (after `aspect_ratio: src.aspect_ratio,`):

```ts
      reel_cover_path: coverPath,
      reel_cover_url: coverUrl,
      reel_cover_is_custom: src.reel_cover_is_custom,
```

- [ ] **Step 4: Surface the cover in `SocialPostRecord` / queries**

In `src/lib/social/queries.ts`:

Add to the `SocialPostRecord` interface (after `aspect_ratio`):

```ts
  reel_cover_path: string | null
  reel_cover_url: string | null
  reel_cover_is_custom: boolean
```

Add the columns to the `SELECT` string (after `aspect_ratio,`):

```ts
  id, title, caption, format, aspect_ratio, reel_cover_path, reel_cover_url, reel_cover_is_custom, status, scheduled_at, posted_at, platforms, collaborators, notes, created_at, updated_at,
```

Add to the `RawRow` type (after `aspect_ratio`):

```ts
  reel_cover_path: string | null
  reel_cover_url: string | null
  reel_cover_is_custom: boolean | null
```

Add to the `shape()` return (after `aspect_ratio: row.aspect_ratio,`):

```ts
    reel_cover_path: row.reel_cover_path,
    reel_cover_url: row.reel_cover_url,
    reel_cover_is_custom: row.reel_cover_is_custom ?? false,
```

- [ ] **Step 5: Add the columns to the DB type**

In `src/types/database.ts`, locate the `social_posts` table's `Row` (and `Insert`/`Update` if present) type and add `reel_cover_path: string | null`, `reel_cover_url: string | null`, `reel_cover_is_custom: boolean`. If `social_posts` is not strongly typed there (e.g. it's a loose/Record type), skip this step — it is for type accuracy only and not required by the build.

- [ ] **Step 6: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add migrations/26_social_reel_cover.sql src/app/actions/social.ts src/lib/social/queries.ts src/types/database.ts
git commit -m "feat(social): persist reel cover (migration 26 + types)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Server publish — cover crop + instagramThumbnail

**Files:** Modify `src/lib/publishing/crop.ts`, `src/lib/publishing/adapter.ts`, `src/lib/publishing/zernio-client.ts`, `src/lib/publishing/publish-service.ts`.

- [ ] **Step 1: Add `cropCover` to `crop.ts`**

Append to `src/lib/publishing/crop.ts`:

```ts
// Cover-crops + resizes an image buffer to exactly w×h (no distortion), for the
// Instagram reel cover (instagramThumbnail; recommended 1080×1920).
export async function cropCover(input: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input, { failOn: 'none' })
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 90 })
    .toBuffer()
}
```

- [ ] **Step 2: Add `instagramThumbnailUrl` to `PublishRequest`**

In `src/lib/publishing/adapter.ts`, add to the `PublishRequest` interface (after `scheduledFor`):

```ts
  /** Optional Instagram reel cover image URL (already cropped to 9:16). Instagram-only. */
  instagramThumbnailUrl?: string
```

- [ ] **Step 3: Send `instagramThumbnail` for Instagram in `buildBody`**

In `src/lib/publishing/zernio-client.ts`, replace the per-platform `psd` construction inside
`buildBody`'s `platforms.map(...)` (the block that currently does
`const psd = p === 'instagram' && collaborators.length > 0 ? { ...(basePsd ?? {}), collaborators } : basePsd`)
with:

```ts
    // Instagram carries extra platformSpecificData: collaborators and (for reels)
    // a custom cover. Facebook just uses the base content-type data.
    let psd: Record<string, unknown> | undefined = basePsd
    if (p === 'instagram') {
      const extra: Record<string, unknown> = { ...(basePsd ?? {}) }
      if (collaborators.length > 0) extra.collaborators = collaborators
      if (req.instagramThumbnailUrl) extra.instagramThumbnail = req.instagramThumbnailUrl
      psd = Object.keys(extra).length > 0 ? extra : undefined
    }
```

(The surrounding `return { platform: p, accountId: accounts[p], ...(psd ? { platformSpecificData: psd } : {}) }` is unchanged.)

- [ ] **Step 4: Crop + attach the cover in `publish-service.ts`**

In `src/lib/publishing/publish-service.ts`:

Import `cropCover` — change the crop import:

```ts
import { cropImageToRatio, cropCover } from './crop'
```

Add the cover columns to `DbPost` (after `aspect_ratio: string`):

```ts
  reel_cover_path: string | null
  reel_cover_url: string | null
  reel_cover_is_custom: boolean
```

Add them to `POST_SELECT`:

```ts
const POST_SELECT =
  'id, caption, format, platforms, collaborators, aspect_ratio, reel_cover_path, reel_cover_url, reel_cover_is_custom, scheduled_at, external_ref, ' +
  'social_post_media ( url, storage_path, media_type, position )'
```

In `sendPost`, inside the existing `try` block, after `croppedPaths = built.croppedPaths` and before
`const req = {`, compute the thumbnail URL:

```ts
    // Reel cover → Instagram custom thumbnail (cover-crop to 9:16). Non-fatal:
    // on any failure we fall back to Instagram's default cover.
    let instagramThumbnailUrl: string | undefined
    if (post.format === 'reel' && post.platforms.includes('instagram') && post.reel_cover_url) {
      try {
        const cResp = await fetch(post.reel_cover_url, { cache: 'no-store' })
        if (cResp.ok) {
          const cover = await cropCover(Buffer.from(await cResp.arrayBuffer()), 1080, 1920)
          const cPath = `published/${post.id}/cover-${Date.now()}.jpg`
          const { error: cErr } = await admin.storage.from(BUCKET).upload(cPath, cover, { contentType: 'image/jpeg', upsert: true })
          if (!cErr) {
            croppedPaths.push(cPath)
            instagramThumbnailUrl = admin.storage.from(BUCKET).getPublicUrl(cPath).data.publicUrl
          }
        }
      } catch (e) {
        console.error('reel cover crop failed:', e)
      }
    }
```

Then add `instagramThumbnailUrl` to the `req` object (after `scheduledFor: post.scheduled_at ?? undefined,`):

```ts
      instagramThumbnailUrl,
```

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/publishing/crop.ts src/lib/publishing/adapter.ts src/lib/publishing/zernio-client.ts src/lib/publishing/publish-service.ts
git commit -m "feat(social): send Instagram reel cover (instagramThumbnail) at publish

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Client first-frame capture + dropzone callback

**Files:** Create `src/lib/social/video-cover.ts`; modify `src/components/social/media-dropzone.tsx`.

- [ ] **Step 1: Create the capture util**

Create `src/lib/social/video-cover.ts`:

```ts
// Client-side first-frame capture for reel covers. Draws the video's first
// frame to a canvas FROM THE LOCAL File (same-origin blob URL, so the canvas is
// not tainted and can be exported). Resolves null on any failure.
export function captureFirstFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const cleanup = () => URL.revokeObjectURL(url)
    const fail = () => { resolve(null); cleanup() }

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      // Seek a hair past 0 to avoid a black initial frame on some encodings.
      try { video.currentTime = Math.min(0.1, video.duration || 0.1) } catch { fail() }
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) { fail(); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => { resolve(blob); cleanup() }, 'image/jpeg', 0.9)
      } catch { fail() }
    }
    video.onerror = fail
    video.src = url
  })
}
```

- [ ] **Step 2: Add the `onVideoSelected` callback to `MediaDropzone`**

In `src/components/social/media-dropzone.tsx`, add the optional prop to the component signature:

```ts
export function MediaDropzone({
  media,
  onChange,
  onVideoSelected,
}: {
  media: MediaItem[]
  onChange: (m: MediaItem[]) => void
  onVideoSelected?: (file: File) => void
}) {
```

In `handleFiles`, inside the video branch, immediately after the existing `next.push({ ... media_type: 'video' ... })` line, add a single `onVideoSelected?.(file)` call. On this branch's base the push line reads:

```ts
          next.push({ url: signed.data.url, storage_path: signed.data.path, media_type: 'video', position: next.length })
          onVideoSelected?.(file)
```

(Add only the `onVideoSelected?.(file)` line — match whatever the actual push line is in the file; do not alter it. The image branch and everything else are unchanged.)

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/social/video-cover.ts src/components/social/media-dropzone.tsx
git commit -m "feat(social): client first-frame capture util + dropzone onVideoSelected

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Composer cover UX (field + state + preview)

**Files:** Create `src/components/social/reel-cover-field.tsx`; modify `src/components/social/post-composer-dialog.tsx`, `src/components/social/post-preview.tsx`.

- [ ] **Step 1: Create the `ReelCoverField` component**

Create `src/components/social/reel-cover-field.tsx` (designed for light + dark; mirrors the dropzone's
button styles):

```tsx
'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Label } from '@/components/ui/label'
import { ImagePlus, RotateCcw, Loader2 } from 'lucide-react'

export function ReelCoverField({
  coverUrl,
  isCustom,
  busy,
  onPickCustom,
  onResetAuto,
}: {
  coverUrl: string | null
  isCustom: boolean
  busy?: boolean
  onPickCustom: (file: File) => void
  onResetAuto: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Label>Reel cover</Label>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="54px" className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">No cover</div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-brand/60 disabled:opacity-60"
          >
            <ImagePlus className="size-3.5" /> Upload custom cover
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={onResetAuto}
              disabled={busy}
              className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" /> Reset to auto
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">Instagram only. Defaults to the video's first frame.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPickCustom(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add cover state + handlers to the composer**

In `src/components/social/post-composer-dialog.tsx`:

Add imports:

```ts
import { captureFirstFrame } from '@/lib/social/video-cover'
import { ReelCoverField } from './reel-cover-field'
```

(`uploadSocialImage` is already imported from `@/app/actions/social`? It is not — the composer imports `createSocialPost, updateSocialPost, deleteSocialPost`. Add `uploadSocialImage` to that import.)

```ts
import { createSocialPost, updateSocialPost, deleteSocialPost, uploadSocialImage } from '@/app/actions/social'
```

Add state (after the `media` state):

```ts
  const [reelCoverUrl, setReelCoverUrl] = useState<string | null>(null)
  const [reelCoverPath, setReelCoverPath] = useState<string | null>(null)
  const [reelCoverIsCustom, setReelCoverIsCustom] = useState(false)
  const [autoCover, setAutoCover] = useState<{ url: string; storage_path: string } | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
```

In the open/reset effect: in the `if (post)` branch add (alongside the other setters):

```ts
      setReelCoverUrl(post.reel_cover_url)
      setReelCoverPath(post.reel_cover_path)
      setReelCoverIsCustom(post.reel_cover_is_custom)
      setAutoCover(post.reel_cover_is_custom ? null : (post.reel_cover_url && post.reel_cover_path ? { url: post.reel_cover_url, storage_path: post.reel_cover_path } : null))
```

and in the `else` (new post) branch add:

```ts
      setReelCoverUrl(null)
      setReelCoverPath(null)
      setReelCoverIsCustom(false)
      setAutoCover(null)
```

Add the three handlers (near `handleGenerate`):

```ts
  // Auto cover: capture the video's first frame and upload it (skipped if a custom cover is set).
  async function handleVideoSelected(file: File) {
    if (reelCoverIsCustom) return
    setCoverBusy(true)
    try {
      const blob = await captureFirstFrame(file)
      if (!blob) return
      const fd = new FormData()
      fd.append('file', new File([blob], 'reel-cover.jpg', { type: 'image/jpeg' }))
      const res = await uploadSocialImage(fd)
      if (res.success) {
        setAutoCover({ url: res.data.url, storage_path: res.data.storage_path })
        setReelCoverUrl(res.data.url)
        setReelCoverPath(res.data.storage_path)
        setReelCoverIsCustom(false)
      }
    } finally {
      setCoverBusy(false)
    }
  }

  async function handlePickCustomCover(file: File) {
    setCoverBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSocialImage(fd)
      if (res.success) {
        setReelCoverUrl(res.data.url)
        setReelCoverPath(res.data.storage_path)
        setReelCoverIsCustom(true)
      }
    } finally {
      setCoverBusy(false)
    }
  }

  function handleResetAutoCover() {
    setReelCoverIsCustom(false)
    setReelCoverUrl(autoCover?.url ?? null)
    setReelCoverPath(autoCover?.storage_path ?? null)
  }
```

- [ ] **Step 3: Wire the dropzone, field, preview, and save/publish payloads**

Pass the callback to the dropzone:

```tsx
              <MediaDropzone media={media} onChange={setMedia} onVideoSelected={handleVideoSelected} />
```

Render the field right after the Media `<div>` block, only for reels:

```tsx
            {format === 'reel' && (
              <ReelCoverField
                coverUrl={reelCoverUrl}
                isCustom={reelCoverIsCustom}
                busy={coverBusy}
                onPickCustom={handlePickCustomCover}
                onResetAuto={handleResetAutoCover}
              />
            )}
```

Add the cover fields to BOTH the `handleSave` `input` object and the `handlePublishNow` `input` object
(after `media,`):

```ts
      reel_cover_path: reelCoverPath,
      reel_cover_url: reelCoverUrl,
      reel_cover_is_custom: reelCoverIsCustom,
```

Pass the cover to the preview (add the prop to the existing `<PostPreview ... />`):

```tsx
          <PostPreview caption={caption} media={media} platforms={platforms} format={format} aspectRatio={aspectRatio} coverUrl={reelCoverUrl} />
```

- [ ] **Step 4: Show the cover for reels in `PostPreview`**

In `src/components/social/post-preview.tsx`, add `coverUrl` to the props type and destructuring:

```ts
  format,
  aspectRatio,
  coverUrl,
}: {
  caption: string
  media: MediaItem[]
  platforms: string[]
  format: string
  aspectRatio: string
  coverUrl?: string | null
}) {
```

In the single-media render (the `else` branch where `media[0].media_type` is video), show the cover
image for reels when present. Replace:

```tsx
          ) : media[0].media_type === 'image' ? (
            <Image src={media[0].url} alt="" fill sizes="220px" className="object-cover" onLoad={handleFirstLoad} />
          ) : (
            <video src={media[0].url} className="size-full object-cover" controls />
          )}
```

with:

```tsx
          ) : media[0].media_type === 'image' ? (
            <Image src={media[0].url} alt="" fill sizes="220px" className="object-cover" onLoad={handleFirstLoad} />
          ) : format === 'reel' && coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="220px" className="object-cover" />
          ) : (
            <video src={media[0].url} className="size-full object-cover" controls />
          )}
```

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/social/reel-cover-field.tsx src/components/social/post-composer-dialog.tsx src/components/social/post-preview.tsx
git commit -m "feat(social): reel cover field in composer (auto frame + custom upload)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Apply `migrations/26_social_reel_cover.sql` in the Supabase SQL Editor.
- [ ] `pnpm lint` + `pnpm build` clean.

**Manual smoke (deployed build):**
- [ ] Attach a video → composer shows a Reel cover preview (auto-captured first frame); the cover also appears in the post preview's 9:16 frame.
- [ ] Upload a custom cover → preview switches to it; "Reset to auto" reverts to the captured frame.
- [ ] Publish a reel to Instagram → the posted cover is the supplied 9:16 image (no distortion).
- [ ] Reel without Instagram selected, and non-reel formats → no cover sent; no regressions to image/carousel/story publishing.
- [ ] Duplicate a reel with a cover → the copy has its own cover file (deleting one doesn't affect the other).
- [ ] Reel cover field renders correctly in light and dark mode.

# A3 — Instagram reel thumbnail: stop the scrunch + custom cover

**Track:** A (Social / Post Scheduling)
**Branch:** `feature/social-reel-thumbnail`
**Status:** Approved design — ready for implementation plan

## Problem

Published Instagram reels show a distorted ("squished") cover. Our publish pipeline sends the reel
video with **no** cover, so Instagram auto-derives one from the first frame and force-fits it to the
reel/grid ratio. (Note: `crop.ts` is *not* the cause — it only crops images and is never applied to
video; the distortion is Instagram's auto-cover.)

## Goal

1. **Default:** give Instagram a clean, undistorted 9:16 cover automatically (cover-crop, no stretch).
2. **Optional:** let the user upload a custom cover image for a reel that overrides the auto frame.

Zernio supports this via `platformSpecificData.instagramThumbnail` (a direct JPEG/PNG URL,
recommended 1080×1920, **Instagram only**), which takes priority over the `thumbOffset` frame picker.

## Decisions (settled in brainstorming)

- **Default cover source:** capture the video's **first frame client-side** (from the local `File`,
  same-origin blob so the canvas isn't tainted). No server-side ffmpeg.
- **Persistence:** a DB **migration** adds cover columns to `social_posts`. Custom cover **overrides**
  the auto-captured one (`is_custom` flag).
- **Platform scope:** **Instagram only**. Facebook reels keep default behavior.

## Architecture

A reel publishes with no cover today → IG distorts its own. The fix always hands IG a pre-made 9:16
cover via `instagramThumbnail`. The cover is either an auto-captured first frame (default) or a
user-uploaded image (override). Flow: compose → capture/choose cover (client) → persist cover ref →
at publish, server cover-crops to 1080×1920 and sends `instagramThumbnail` for IG reels.

### 1. Data model — migration `26_social_reel_cover.sql`

Add to `social_posts` (non-destructive `add column if not exists`):
- `reel_cover_path text` — storage path of the active cover image.
- `reel_cover_url text` — public URL of the active cover.
- `reel_cover_is_custom boolean not null default false` — true when user-uploaded; false when
  auto-captured.

Teach `save_social_post` to persist all three in both the insert and update branches (mirroring the
collaborators pattern in migration 24). On update, the action always sends the keys, so an explicit
clear sets them to null/false.

Thread through:
- `SocialPostInput` (`src/app/actions/social.ts`) — add `reel_cover_path?`, `reel_cover_url?`,
  `reel_cover_is_custom?`; pass them in the `p_post` RPC payload.
- `SocialPostRecord` + the post query (`src/lib/social/queries.ts`) — select the three columns so
  edit-load restores the cover.
- `duplicateSocialPost` — copy the cover file to a fresh storage path (like media) and carry the
  cover fields, so a duplicated reel never shares a cover file with its source.

### 2. Cover capture & selection (client)

- New util `src/lib/social/video-cover.ts` → `captureFirstFrame(file: File): Promise<Blob | null>`:
  load the File via an object URL into a `<video>`, seek to the first frame, draw to a `<canvas>` at
  the video's natural size, export `image/jpeg`. Resolve `null` on any failure. Revoke the object URL.
- `MediaDropzone` gains a thin, cover-agnostic `onVideoSelected?: (file: File) => void` callback,
  fired when a video file is added. The dropzone knows nothing about covers.
- The composer (`post-composer-dialog.tsx`):
  - On `onVideoSelected(file)`: if no custom cover is set, `captureFirstFrame(file)` → upload the blob
    via `uploadSocialImage` → store as the **auto cover** (and as the active cover).
  - Holds cover state: the active cover `{ url, storage_path }`, an `is_custom` flag, and the
    last auto-captured cover (for "Reset to auto").
- New `ReelCoverField` component (`src/components/social/reel-cover-field.tsx`), shown only when
  `format === 'reel'`: previews the active cover; an "Upload custom cover" image input (sets the
  custom cover, `is_custom = true`); and "Reset to auto" (reverts to the captured frame, or clears if
  none). Precedence: **custom > auto**. Designed for light and dark mode.

### 3. Publish (server)

- `src/lib/publishing/crop.ts` — add `cropCover(input: Buffer, w: number, h: number): Promise<Buffer>`
  using sharp `.resize(w, h, { fit: 'cover', position: 'centre' }).jpeg({ quality: 90 })` (cover-crop +
  resize in one step, no distortion).
- `src/lib/publishing/publish-service.ts` — `POST_SELECT` includes the three cover columns; `DbPost`
  gains them. In `sendPost`, after `buildMedia`, when `format === 'reel'` **and** `platforms` includes
  `'instagram'` **and** a `reel_cover_url` exists: fetch the cover, `cropCover(buf, 1080, 1920)`,
  upload to `published/{id}/cover-{Date.now()}.jpg`, push the path to `croppedPaths` (existing cleanup
  removes it), `getPublicUrl`, and set `req.instagramThumbnailUrl`.
- `src/lib/publishing/adapter.ts` — `PublishRequest` gains `instagramThumbnailUrl?: string`.
- `src/lib/publishing/zernio-client.ts` — `buildBody` adds `instagramThumbnail: req.instagramThumbnailUrl`
  to the Instagram `platformSpecificData` (alongside `contentType: 'reels'`) when present.

### 4. Preview (minor)

`src/components/social/post-preview.tsx` — for reels, render the active cover image in the 9:16 frame
when one exists (so the user sees what Instagram will use); otherwise the current video frame.

## Out of scope

- Server-side ffmpeg frame extraction.
- Facebook cover / thumbnail.
- The `thumbOffset` frame-time picker (we always supply a cover image instead).
- Any change to image/carousel/story handling.

## Error handling

- `captureFirstFrame` returns `null` on decode/seek failure → no auto cover → IG default (graceful).
- A reel with no cover sends no `instagramThumbnail` (graceful IG default).
- Cover present but format not reel, or IG not selected → cover not sent.
- The cover crop derivative is tracked in `croppedPaths` and cleaned up on posted/reconcile/cancel,
  exactly like image crops.

## Verification

No test runner. Verify each task with `pnpm lint` + `pnpm build` (clean). DB migration applied
manually in the Supabase SQL Editor before live smoke.

**Manual smoke (deployed build):**
- Attach a video → composer shows a Reel cover preview (auto-captured first frame).
- Upload a custom cover → preview switches to it; "Reset to auto" reverts.
- Publish a reel to Instagram → the cover is the supplied 9:16 image (no distortion); confirm via the
  posted reel's cover and that `instagramThumbnail` was sent (vendor/logs).
- Reel without IG selected, or non-reel formats → no cover sent; no regressions.
- Duplicate a reel with a cover → the copy has its own cover file (deleting one doesn't affect the
  other).
- Composer Reel cover field renders correctly in light and dark mode.

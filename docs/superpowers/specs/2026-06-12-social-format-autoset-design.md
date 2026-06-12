# A1 — Auto-set post format & aspect ratio from uploaded media

**Track:** A (Social / Post Scheduling)
**Branch:** `feature/social-format-autoset`
**Status:** Approved design — ready for implementation plan

## Problem

In the post composer, **Format** (`image` / `carousel` / `reel` / `story`) and **Aspect ratio**
(`auto` / `1:1` / `4:5` / `3:4` / `1.91:1`) are both manual `Select`s. The user must set them by
hand even though the attached media already determines the correct values most of the time. This is
redundant data entry and error-prone (e.g. forgetting to switch to Carousel after adding a second
image).

## Goal

When media is attached in a **new** post, automatically pre-fill Format and Aspect ratio from the
media, while keeping both fields editable and never clobbering a manual choice.

## Decisions (settled in brainstorming)

- **Scope:** derive **both** post type (Format) **and** aspect ratio. Aspect ratio is derived by
  measuring the media's real pixel dimensions and snapping to the nearest preset.
- **Manual override:** sticky. Auto pre-fills a field only until the user manually changes it; after
  that, auto stops re-deriving that field. Flags reset when media is cleared to empty.
- **Story:** never produced by auto. A manually selected `story` is protected by its touched flag.
- **Field UI:** Format and Aspect ratio stay editable `Select`s; auto only pre-fills them.
- **No DB migration:** `format` and `aspect_ratio` are already persisted columns. Measured pixel
  dimensions are a transient, in-memory input only — never persisted or loaded.

## Architecture (chosen approach)

**Measure in dropzone, derive in composer.**

1. **`media-dropzone.tsx`** — when files attach, measure each file's pixel dimensions before/at
   upload (images via an `Image`/`createImageBitmap`, videos via a `<video>` `loadedmetadata`) and
   tag the in-memory `MediaItem` with transient `width?: number` / `height?: number`. These fields
   are optional and are NOT sent to the DB or read back on load.
2. **`social.ts`** — add pure helpers:
   - `deriveFormat(media: MediaItem[]): SocialFormat | null`
   - `deriveAspect(media: MediaItem[]): SocialAspectRatio | null`
   - aspect snap tolerance constant.
3. **`post-composer-dialog.tsx`** — add `formatTouched` / `aspectTouched` flags and an effect that
   runs on `media` change, applying derived values only while the corresponding flag is false.
   Manual `onValueChange` handlers set the flag true.

### Derivation rules — Format

| Media | Derived format |
|-------|----------------|
| 1 image, no video | `image` |
| 2+ media (any mix of image/video) | `carousel` |
| exactly 1 video, no images | `reel` |
| 0 media | leave current value untouched (return `null`) |

### Derivation rules — Aspect ratio

- Measure the **cover item**: the lowest-`position` **image** (carousels/images use one ratio).
- Compute `width / height`, snap to the nearest preset value among `1:1` (1.0), `4:5` (0.8),
  `3:4` (0.75), `1.91:1` (1.91).
- If the measured ratio is **not within ±0.06** of any preset, return `auto` (match image) rather
  than forcing a wrong crop.
- Only derived when the (derived or current) format is `image` or `carousel`. For `reel` the aspect
  `Select` is hidden, so no aspect derivation is applied.
- If no measurable image is present (e.g. video-only, or dimensions unavailable), return `null`
  (leave current).

### Sticky override behavior

- `formatTouched` / `aspectTouched` start `false` for a **new** post.
- The media-change effect applies `deriveFormat` / `deriveAspect` only when the respective flag is
  `false` and the helper returns non-`null`.
- A manual change to the Format or Aspect `Select` sets the respective flag to `true`.
- When `media` transitions to empty (length 0), both flags reset to `false`.
- **Edit mode:** an existing post is **fully sticky** — the media-change effect early-returns when a
  `post` is being edited, so derivation never runs and a saved `format`/`aspect_ratio` is never
  reshaped (on open or by adding/removing media). The clear-resets-flags resume behavior applies to
  **new posts only**. (This is a refinement from the original "edit re-derives after clearing media"
  idea: it eliminates a same-commit stale-flag race where opening an edit post with media could
  overwrite its saved values, and it is the safer, more predictable behavior.)

## Out of scope

- Persisting media dimensions to the DB.
- Changing the Reel aspect-ratio handling (Reels remain Instagram's fixed vertical ratio downstream).
- Any change to publishing, `PostPreview` rendering, or the crop pipeline.

## Verification

- `pnpm lint` and `pnpm build` clean.
- Manual smoke on the deployed build (local has placeholder Supabase creds):
  - Attach 1 image → Format = Single image; aspect snaps to the image's nearest preset (or `auto`).
  - Attach a 2nd image → Format flips to Carousel.
  - Attach a single video → Format = Reel; aspect Select hidden.
  - Manually change Format, then add/remove media → manual value sticks (no auto re-derive).
  - Clear all media, re-add (new post) → derivation resumes.
  - Open an existing post → Format/aspect unchanged on open, and stay unchanged when adding/removing
    media (edit mode is fully sticky).
- Verify both light and dark mode for any UI affordance touched.

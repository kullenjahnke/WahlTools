# A1 — Format/Aspect Autoset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-derive the post Format and Aspect ratio from attached media in the composer, with a sticky manual override.

**Architecture:** Measure pixel dimensions in `MediaDropzone` at attach time (transient, in-memory only), expose pure `deriveFormat`/`deriveAspect` helpers in `social.ts`, and apply them in `post-composer-dialog.tsx` via a media-change effect gated by `formatTouched`/`aspectTouched` flags.

**Tech Stack:** Next.js 15 / React 19, TypeScript, existing Supabase upload flow. No test runner — verification is `pnpm lint` + `pnpm build` plus manual smoke on the deployed build.

---

## Note on verification

This repo has **no unit-test runner**. Each task's verification step is `pnpm lint` and `pnpm build` (both must be clean), plus the manual-smoke checklist at the end, run against the deployed Vercel build (local Supabase creds are placeholders, so data/auth flows can't run locally). Design every touched surface for **both light and dark** mode.

---

## File Structure

- **Modify** `src/lib/config/social.ts` — add pure derivation helpers (`deriveFormat`, `deriveAspect`) and the snap-tolerance constant. Pure functions, no React.
- **Modify** `src/components/social/media-dropzone.tsx` — add optional `width`/`height` to `MediaItem`; measure dimensions for each file at attach time.
- **Modify** `src/components/social/post-composer-dialog.tsx` — add `formatTouched`/`aspectTouched` state, a media-change effect that applies the helpers, and mark-touched handlers on the two `Select`s.

`MediaItem` is the shared interface (exported from `media-dropzone.tsx` and imported by the composer + preview), so the `width`/`height` addition is the contract that links the tasks.

---

## Task 1: Add optional dimensions to `MediaItem` and the derivation helpers

**Files:**
- Modify: `src/components/social/media-dropzone.tsx` (the `MediaItem` interface, ~line 9)
- Modify: `src/lib/config/social.ts` (append new helpers near the format/aspect config, ~line 67)

- [ ] **Step 1: Add `width`/`height` to `MediaItem`**

In `src/components/social/media-dropzone.tsx`, change the interface:

```ts
export interface MediaItem {
  url: string
  storage_path: string
  media_type: 'image' | 'video'
  position: number
  /** Transient pixel dimensions measured at attach time. In-memory only — never persisted or loaded from the DB. */
  width?: number
  height?: number
}
```

- [ ] **Step 2: Add derivation helpers to `social.ts`**

In `src/lib/config/social.ts`, append after `aspectRatioNumber` (~line 67). Note: this file must stay free of React/DOM imports — it's pure config. Reference `MediaItem` via a local structural type so `social.ts` does not import from a component:

```ts
/** Minimal media shape the derivation helpers need (structural — avoids importing the component). */
export interface DerivableMedia {
  media_type: 'image' | 'video'
  position: number
  width?: number
  height?: number
}

/** How close a measured ratio must be to a preset to snap to it; otherwise we fall back to 'auto'. */
export const ASPECT_SNAP_TOLERANCE = 0.06

/**
 * Derive the post Format from attached media.
 * - 1 image, no video → 'image'
 * - 2+ media (any mix) → 'carousel'
 * - exactly 1 video, no images → 'reel'
 * - 0 media → null (leave current value untouched)
 */
export function deriveFormat(media: DerivableMedia[]): SocialFormat | null {
  if (media.length === 0) return null
  if (media.length >= 2) return 'carousel'
  // exactly one item
  return media[0].media_type === 'video' ? 'reel' : 'image'
}

/**
 * Derive the Aspect ratio by measuring the cover image (lowest-position image) and snapping
 * to the nearest preset. Returns 'auto' when the measured ratio is outside ASPECT_SNAP_TOLERANCE
 * of every preset, and null when there is no measurable image (leave current value).
 */
export function deriveAspect(media: DerivableMedia[]): SocialAspectRatio | null {
  const cover = media
    .filter((m) => m.media_type === 'image' && m.width && m.height)
    .sort((a, b) => a.position - b.position)[0]
  if (!cover || !cover.width || !cover.height) return null
  const ratio = cover.width / cover.height
  let best: { value: SocialAspectRatio; diff: number } | null = null
  for (const a of SOCIAL_ASPECT_RATIOS) {
    if (a.ratio == null) continue // skip 'auto'
    const diff = Math.abs(ratio - a.ratio)
    if (!best || diff < best.diff) best = { value: a.value, diff }
  }
  if (!best || best.diff > ASPECT_SNAP_TOLERANCE) return 'auto'
  return best.value
}
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean (no new errors/warnings introduced by these changes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/config/social.ts src/components/social/media-dropzone.tsx
git commit -m "feat(social): media dimensions + format/aspect derivation helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Measure dimensions in `MediaDropzone`

**Files:**
- Modify: `src/components/social/media-dropzone.tsx` (the `handleFiles` loop, ~lines 27-63)

- [ ] **Step 1: Add a dimension-measuring helper**

In `src/components/social/media-dropzone.tsx`, add above the `MediaDropzone` component (after the `const VIDEO_MAX` line):

```ts
/** Measure pixel dimensions of an image/video File. Resolves to null on any failure. */
function measureDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(url)
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => { resolve({ width: v.videoWidth, height: v.videoHeight }); cleanup() }
      v.onerror = () => { resolve(null); cleanup() }
      v.src = url
    } else {
      const img = new window.Image()
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); cleanup() }
      img.onerror = () => { resolve(null); cleanup() }
      img.src = url
    }
  })
}
```

- [ ] **Step 2: Capture dimensions when pushing each `MediaItem`**

In `handleFiles`, measure before the upload work and spread the result into the pushed item. Update the video branch:

```ts
        if (file.type.startsWith('video/')) {
          const dims = await measureDimensions(file)
          const signed = await createSocialVideoUploadUrl(file.name)
          if (!signed.success) throw new Error(signed.error)
          const supabase = createClientClient()
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(signed.data.path, signed.data.token, file)
          if (upErr) throw upErr
          next.push({ url: signed.data.url, storage_path: signed.data.path, media_type: 'video', position: next.length, ...(dims ?? {}) })
        } else {
          const dims = await measureDimensions(file)
          const fd = new FormData()
          fd.append('file', file)
          const res = await uploadSocialImage(fd)
          if (!res.success) throw new Error(res.error)
          next.push({ ...res.data, position: next.length, ...(dims ?? {}) })
        }
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/media-dropzone.tsx
git commit -m "feat(social): measure media dimensions on attach

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire sticky auto-derivation into the composer

**Files:**
- Modify: `src/components/social/post-composer-dialog.tsx` (imports ~line 15; state ~lines 50-51; reset effect ~lines 66-94; Format/Aspect `Select`s ~lines 269-300)

- [ ] **Step 1: Import the helpers**

Update the `social` config import (~line 15) to add `deriveFormat, deriveAspect`:

```ts
import { SOCIAL_FORMATS, SOCIAL_STATUSES, SOCIAL_PLATFORMS, SOCIAL_ASPECT_RATIOS, postLabel, deriveFormat, deriveAspect } from '@/lib/config/social'
```

- [ ] **Step 2: Add touched-flag state**

After the `aspectRatio` state (~line 51), add:

```ts
  const [formatTouched, setFormatTouched] = useState(false)
  const [aspectTouched, setAspectTouched] = useState(false)
```

- [ ] **Step 3: Initialize the flags in the open/reset effect**

In the `useEffect` keyed on `[open, post, initialDate]` (~lines 66-94): in the `if (post)` branch set both flags to `true` (existing post is sticky); in the `else` branch set both to `false`. Add these lines alongside the existing setters:

```ts
    if (post) {
      // ...existing setters...
      setFormatTouched(true)
      setAspectTouched(true)
    } else {
      // ...existing setters...
      setFormatTouched(false)
      setAspectTouched(false)
    }
```

- [ ] **Step 4: Add the media-change derivation effect**

Add a new effect after the open/reset effect (after ~line 94):

```ts
  // Auto-derive format/aspect from media unless the user has manually touched the field.
  // Clearing media to empty resets the touched flags so derivation can resume.
  useEffect(() => {
    if (media.length === 0) {
      setFormatTouched(false)
      setAspectTouched(false)
      return
    }
    if (!formatTouched) {
      const f = deriveFormat(media)
      if (f) setFormat(f)
    }
    if (!aspectTouched) {
      const a = deriveAspect(media)
      if (a) setAspectRatio(a)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media])
```

> The `media`-only dependency is intentional: derivation should fire on media changes, not when the touched flags flip. The flags are read as current values inside the effect.

- [ ] **Step 5: Mark fields touched on manual change**

Update the Format `Select` (~line 272) and Aspect `Select` (~line 293) `onValueChange` to set the flag:

```tsx
                <Select value={format} onValueChange={(v) => { setFormatTouched(true); setFormat(v) }}>
```

```tsx
                <Select value={aspectRatio} onValueChange={(v) => { setAspectTouched(true); setAspectRatio(v) }}>
```

- [ ] **Step 6: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/social/post-composer-dialog.tsx
git commit -m "feat(social): auto-set format/aspect from media with sticky override

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (manual smoke — deployed build)

After all tasks merge to the branch and deploy, confirm in the composer:

- [ ] Attach 1 image → Format = **Single image**; aspect snaps to the image's nearest preset (or **Auto** when no preset is within ±0.06).
- [ ] Attach a 2nd image → Format flips to **Carousel**.
- [ ] Attach a single video → Format = **Reel**; the Aspect Select is hidden.
- [ ] Manually change Format, then add/remove media → the manual value sticks (no auto re-derive).
- [ ] Manually change Aspect ratio, then add/remove media → aspect sticks.
- [ ] Clear all media, then re-add → derivation resumes.
- [ ] Open an existing post → Format/aspect unchanged on open.
- [ ] Composer renders correctly in both light and dark mode.
```

# Social Calendar Phase 2 — Live Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish scheduled (and on-demand) social posts to Instagram + Facebook via the Zernio (formerly Late) API, honoring the chosen aspect ratio (server-side pre-crop), syncing results back to post status via webhook + daily reconcile, with failure alerts.

**Architecture:** A thin vendor-agnostic `PublishAdapter` (concrete impl: Zernio REST) behind a `publish-service` that pre-crops images with `sharp`, uploads derivatives, and sends posts to Zernio with a `scheduledFor` time (vendor owns scheduling). A signed webhook flips status to posted/failed; the existing daily cron reconciles misses. Editing a scheduled post does a strict **cancel-then-recreate** at the vendor to avoid duplicates.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` + service-role admin), Resend, **`sharp`** (new), Zernio API.

**Spec:** [docs/superpowers/specs/2026-06-08-social-calendar-phase2-publishing-design.md](../specs/2026-06-08-social-calendar-phase2-publishing-design.md).

## Conventions

- **No test runner** in this repo — verify with `pnpm lint` + `pnpm build` per task; `pnpm build` at integration milestones (Tasks 8, 9, 13, 15). Live publishing is verified manually once vendor creds are set (Task 15).
- Server-action return shape `{ success, error?, data? }`; `revalidatePath`. Trusted server logic (publish-service, webhook, cron) uses the **service-role admin client** (`createSupabaseAdminClient`), never exposed to the browser.
- Branch `feature/social-publishing` (already created). Commit after each task.
- `external_ref` JSON shape (in `social_posts`): `{ "vendorId": string, "croppedPaths": string[] }`.
- Zernio API: base `https://zernio.com/api/v1`, header `Authorization: Bearer <ZERNIO_API_KEY>`. Two env vars: `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`. Account IDs are resolved at runtime via `GET /v1/accounts` (mapped by platform) — no hardcoded profile id.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/publishing/adapter.ts` | `PublishAdapter` interface + request/result types |
| `src/lib/publishing/rules.ts` | Per-format validation + constraints |
| `src/lib/publishing/crop.ts` | `sharp` center-crop to a ratio |
| `src/lib/publishing/zernio-client.ts` | Concrete Zernio REST adapter + account resolution + status mapping |
| `src/lib/publishing/publish-service.ts` | Crop pipeline, send, strict cancel-then-recreate, cleanup |
| `src/app/actions/publish.ts` | `publishPost` server action (scheduled + publish-now) |
| `src/app/api/webhooks/zernio/route.ts` | Signed webhook → status sync + cleanup + failure email |
| `src/lib/email/send-publish-failure.ts` | Resend failure email |
| `src/app/(dashboard)/dashboard/social/settings/page.tsx` | Connection-status settings page |
| `src/components/social/connection-status.tsx` | (server-rendered) account connection display |
| migration `migrations/22_social_publishing.sql` | Optional reconcile index (documented) |

---

### Task 1: Dependency, env, and Zernio config

**Files:**
- Modify: `package.json` (add `sharp`)
- Modify: `CLAUDE.md` (env section)
- Create: `src/lib/publishing/config.ts`

- [ ] **Step 1: Add `sharp`**

Run: `pnpm add sharp`
Expected: `sharp` added to `dependencies`, lockfile updated.

- [ ] **Step 2: Create `src/lib/publishing/config.ts`**

```typescript
// Zernio (formerly Late) API config. Account IDs are resolved at runtime from
// GET /v1/accounts (mapped by platform), so only the API key + webhook secret
// are env-configured.
export const ZERNIO_BASE = 'https://zernio.com/api/v1'

export function zernioApiKey(): string {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('ZERNIO_API_KEY is not set')
  return key
}

export function zernioWebhookSecret(): string {
  const s = process.env.ZERNIO_WEBHOOK_SECRET
  if (!s) throw new Error('ZERNIO_WEBHOOK_SECRET is not set')
  return s
}

export const SOCIAL_PUBLISH_URL =
  'https://wahlburgers-price-tracker.vercel.app/dashboard/social'
```

- [ ] **Step 3: Document env in `CLAUDE.md`**

In the Environment Variables block, add these lines (after `CRON_SECRET`):

```
ZERNIO_API_KEY=<zernio-publishing-api-key>     # Phase 2 live publishing
ZERNIO_WEBHOOK_SECRET=<zernio-webhook-hmac-secret>
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add package.json pnpm-lock.yaml CLAUDE.md src/lib/publishing/config.ts
git commit -m "feat(publishing): add sharp + Zernio config and env docs"
```

---

### Task 2: Publish adapter interface

**Files:**
- Create: `src/lib/publishing/adapter.ts`

- [ ] **Step 1: Write `src/lib/publishing/adapter.ts`**

```typescript
// Vendor-agnostic publishing interface. One concrete impl (Zernio) lives in
// zernio-client.ts; swapping vendors means adding another impl, nothing else.

export type PublishMediaType = 'image' | 'video'

export interface PublishMedia {
  url: string
  type: PublishMediaType
}

export interface PublishRequest {
  caption: string
  /** Ordered media (already cropped/derived). */
  media: PublishMedia[]
  /** Our platform values, e.g. ['instagram','facebook']. */
  platforms: string[]
  /** Our format: image | carousel | reel | story. Drives per-platform content type. */
  format: string
  /** ISO timestamp for scheduled publishing; omit for publish-now. */
  scheduledFor?: string
}

export interface PublishResult {
  vendorId: string
  /** Normalized: scheduled | posted | failed | partial | cancelled | pending. */
  status: string
}

export interface PublishStatus {
  status: string
  /** Human-readable failure detail if failed/partial. */
  error?: string
}

export interface PublishAdapter {
  schedule(req: PublishRequest): Promise<PublishResult>
  publishNow(req: PublishRequest): Promise<PublishResult>
  getStatus(vendorId: string): Promise<PublishStatus>
  /** Cancels a not-yet-published post. Idempotent: treats "already gone" as success. */
  cancel(vendorId: string): Promise<void>
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add src/lib/publishing/adapter.ts
git commit -m "feat(publishing): add vendor-agnostic PublishAdapter interface"
```

---

### Task 3: Per-format publishing rules

**Files:**
- Create: `src/lib/publishing/rules.ts`

- [ ] **Step 1: Write `src/lib/publishing/rules.ts`**

```typescript
import { SOCIAL_PLATFORM_VALUES } from '@/lib/config/social'

export interface PublishValidationInput {
  format: string
  platforms: string[]
  caption: string | null
  media: { media_type: 'image' | 'video' }[]
}

const CAPTION_MAX = 2200 // Instagram caption limit

// Returns an error string if the post can't be published, else null.
// Per-format media constraints mirror Instagram's documented limits.
export function validateForPublish(input: PublishValidationInput): string | null {
  const { format, platforms, caption, media } = input

  if (!platforms.length) return 'Pick at least one platform (Instagram and/or Facebook).'
  if (!platforms.every((p) => (SOCIAL_PLATFORM_VALUES as string[]).includes(p))) {
    return 'Unsupported platform selected.'
  }
  if ((caption?.length ?? 0) > CAPTION_MAX) return `Caption is too long (max ${CAPTION_MAX} characters).`

  const images = media.filter((m) => m.media_type === 'image').length
  const videos = media.filter((m) => m.media_type === 'video').length

  switch (format) {
    case 'image':
      if (images !== 1 || videos !== 0) return 'A single-image post needs exactly one image.'
      break
    case 'carousel':
      if (media.length < 2) return 'A carousel needs at least 2 media items.'
      if (media.length > 10) return 'A carousel can have at most 10 media items.'
      break
    case 'reel':
      if (videos !== 1 || images !== 0) return 'A reel needs exactly one video.'
      break
    case 'story':
      if (media.length !== 1) return 'A story needs exactly one image or video.'
      break
    default:
      return 'Unknown post format.'
  }
  return null
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add src/lib/publishing/rules.ts
git commit -m "feat(publishing): per-format publish validation rules"
```

---

### Task 4: Image crop utility

**Files:**
- Create: `src/lib/publishing/crop.ts`

- [ ] **Step 1: Write `src/lib/publishing/crop.ts`**

```typescript
import sharp from 'sharp'
import { aspectRatioNumber } from '@/lib/config/social'

// Center-crops an image buffer to the given aspect ratio value ('1:1' etc.).
// 'auto' (or unknown) returns the original buffer unchanged. Returns the
// cropped (or original) buffer plus the output extension.
export async function cropImageToRatio(
  input: Buffer,
  aspectRatio: string
): Promise<{ buffer: Buffer; ext: string }> {
  const ratio = aspectRatioNumber(aspectRatio) // number (w/h) or null for 'auto'
  if (ratio == null) return { buffer: input, ext: 'jpg' }

  const img = sharp(input, { failOn: 'none' })
  const meta = await img.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (!w || !h) return { buffer: input, ext: 'jpg' }

  const currentRatio = w / h
  let cropW = w
  let cropH = h
  if (currentRatio > ratio) {
    // too wide → trim width
    cropW = Math.round(h * ratio)
  } else if (currentRatio < ratio) {
    // too tall → trim height
    cropH = Math.round(w / ratio)
  }
  const left = Math.max(0, Math.round((w - cropW) / 2))
  const top = Math.max(0, Math.round((h - cropH) / 2))

  const out = await img
    .extract({ left, top, width: cropW, height: cropH })
    .jpeg({ quality: 90 })
    .toBuffer()
  return { buffer: out, ext: 'jpg' }
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds (confirms `sharp` builds in the Next server bundle).

```bash
git add src/lib/publishing/crop.ts
git commit -m "feat(publishing): sharp center-crop to aspect ratio"
```

---

### Task 5: Zernio client (concrete adapter)

**Files:**
- Create: `src/lib/publishing/zernio-client.ts`

- [ ] **Step 1: Write `src/lib/publishing/zernio-client.ts`**

```typescript
import { ZERNIO_BASE, zernioApiKey } from './config'
import type { PublishAdapter, PublishRequest, PublishResult, PublishStatus } from './adapter'

// --- low-level fetch helpers ---
async function zfetch(path: string, init?: RequestInit) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${zernioApiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
  return res
}

// Resolve platform -> Zernio accountId from the connected accounts.
// Cached for the process lifetime (accounts rarely change).
let accountCache: Record<string, string> | null = null
export async function resolveAccountIds(): Promise<Record<string, string>> {
  if (accountCache) return accountCache
  const res = await zfetch('/accounts')
  if (!res.ok) throw new Error(`Zernio accounts fetch failed: ${res.status}`)
  const body = (await res.json()) as { accounts?: ZernioAccount[] } | ZernioAccount[]
  const accounts: ZernioAccount[] = Array.isArray(body) ? body : body.accounts ?? []
  const map: Record<string, string> = {}
  for (const a of accounts) {
    if (a.isActive !== false && a.platform && a._id && !map[a.platform]) map[a.platform] = a._id
  }
  accountCache = map
  return map
}
interface ZernioAccount { _id: string; platform: string; username?: string; isActive?: boolean }

// Map our format -> Instagram/Facebook platformSpecificData.contentType.
function contentTypeFor(format: string): Record<string, unknown> | undefined {
  if (format === 'reel') return { contentType: 'reels' }
  if (format === 'story') return { contentType: 'story' }
  return undefined
}

// Normalize Zernio post.status -> our vocabulary.
function normalizeStatus(zStatus: string): string {
  switch (zStatus) {
    case 'published': return 'posted'
    case 'partial': return 'partial'
    case 'failed': return 'failed'
    case 'cancelled': return 'cancelled'
    case 'scheduled':
    case 'pending':
    case 'draft':
    default: return 'scheduled'
  }
}

async function buildBody(req: PublishRequest, publishNow: boolean) {
  const accounts = await resolveAccountIds()
  const psd = contentTypeFor(req.format)
  const platforms = req.platforms
    .map((p) => {
      const accountId = accounts[p]
      if (!accountId) return null
      return { platform: p, accountId, ...(psd ? { platformSpecificData: psd } : {}) }
    })
    .filter(Boolean)
  if (platforms.length === 0) throw new Error('No connected account matches the selected platforms')

  return {
    content: req.caption,
    mediaItems: req.media.map((m) => ({ type: m.type, url: m.url })),
    platforms,
    ...(publishNow ? { publishNow: true } : { scheduledFor: req.scheduledFor, timezone: 'UTC' }),
  }
}

async function createPost(req: PublishRequest, publishNow: boolean): Promise<PublishResult> {
  const body = await buildBody(req, publishNow)
  const res = await zfetch('/posts', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio create post failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as { post?: { _id: string; status?: string } }
  const post = json.post
  if (!post?._id) throw new Error('Zernio create post: missing post id in response')
  return { vendorId: post._id, status: normalizeStatus(post.status ?? 'scheduled') }
}

export const zernioAdapter: PublishAdapter = {
  schedule: (req) => createPost(req, false),
  publishNow: (req) => createPost(req, true),

  async getStatus(vendorId: string): Promise<PublishStatus> {
    const res = await zfetch(`/posts/${vendorId}`)
    if (res.status === 404) return { status: 'cancelled' }
    if (!res.ok) throw new Error(`Zernio status failed: ${res.status}`)
    const json = (await res.json()) as {
      post?: { status?: string; platforms?: { status?: string; error?: string }[] }
    }
    const status = normalizeStatus(json.post?.status ?? 'scheduled')
    const error = (json.post?.platforms ?? []).find((p) => p.error)?.error
    return { status, error }
  },

  async cancel(vendorId: string): Promise<void> {
    const res = await zfetch(`/posts/${vendorId}`, { method: 'DELETE' })
    // 404 = already gone / already published-then-removed: treat as success (idempotent).
    if (res.ok || res.status === 404) return
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio cancel failed: ${res.status} ${text}`)
  },
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint`
Expected: clean.

> **Live-doc note:** endpoint paths/field names match the Zernio reference (`POST /v1/posts`, `DELETE /v1/posts/:id`, `GET /v1/posts/:id`, `GET /v1/accounts`, body fields `content`/`mediaItems`/`platforms`/`scheduledFor`/`publishNow`). If the live API differs at integration time, adjust only this file — the interface insulates the rest.

```bash
git add src/lib/publishing/zernio-client.ts
git commit -m "feat(publishing): Zernio REST adapter (schedule/publishNow/status/cancel)"
```

---

### Task 6: Publish service (crop pipeline + send + cancel)

**Files:**
- Create: `src/lib/publishing/publish-service.ts`

- [ ] **Step 1: Write `src/lib/publishing/publish-service.ts`**

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { zernioAdapter } from './zernio-client'
import { cropImageToRatio } from './crop'
import { validateForPublish } from './rules'
import type { PublishMedia, PublishResult } from './adapter'

const BUCKET = 'social-media'

interface DbMedia { url: string; storage_path: string; media_type: 'image' | 'video'; position: number }
interface DbPost {
  id: string
  caption: string | null
  format: string
  platforms: string[]
  aspect_ratio: string
  scheduled_at: string | null
  external_ref: { vendorId?: string; croppedPaths?: string[] } | null
  social_post_media: DbMedia[] | null
}

const POST_SELECT =
  'id, caption, format, platforms, aspect_ratio, scheduled_at, external_ref, ' +
  'social_post_media ( url, storage_path, media_type, position )'

async function loadPost(admin: ReturnType<typeof createSupabaseAdminClient>, id: string): Promise<DbPost | null> {
  const { data } = await admin.from('social_posts').select(POST_SELECT).eq('id', id).maybeSingle()
  return (data as unknown as DbPost) ?? null
}

// Pre-crop images to the post's ratio, upload derivatives, return media URLs + new cropped paths.
async function buildMedia(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  post: DbPost
): Promise<{ media: PublishMedia[]; croppedPaths: string[] }> {
  const ordered = (post.social_post_media ?? []).slice().sort((a, b) => a.position - b.position)
  const media: PublishMedia[] = []
  const croppedPaths: string[] = []

  for (let i = 0; i < ordered.length; i++) {
    const m = ordered[i]
    if (m.media_type !== 'image' || post.aspect_ratio === 'auto') {
      media.push({ url: m.url, type: m.media_type })
      continue
    }
    const resp = await fetch(m.url, { cache: 'no-store' })
    if (!resp.ok) throw new Error(`Could not fetch media for crop: ${resp.status}`)
    const original = Buffer.from(await resp.arrayBuffer())
    const { buffer, ext } = await cropImageToRatio(original, post.aspect_ratio)
    const path = `published/${post.id}/${i}-${Date.now()}.${ext}`
    const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`Cropped upload failed: ${error.message}`)
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)
    media.push({ url: publicUrl, type: 'image' })
    croppedPaths.push(path)
  }
  return { media, croppedPaths }
}

async function removeCropped(admin: ReturnType<typeof createSupabaseAdminClient>, paths?: string[]) {
  if (paths && paths.length) await admin.storage.from(BUCKET).remove(paths)
}

/**
 * Strict cancel-then-recreate: if the post already has a vendorId, cancel it
 * FIRST and only proceed once cancellation succeeds (prevents duplicate posts).
 * Then crop + send, and persist the new external_ref. `now` => publish immediately.
 */
export async function sendPost(id: string, opts: { now?: boolean }): Promise<{ success: boolean; error?: string }> {
  const admin = createSupabaseAdminClient()
  const post = await loadPost(admin, id)
  if (!post) return { success: false, error: 'Post not found' }

  const invalid = validateForPublish({
    format: post.format,
    platforms: post.platforms,
    caption: post.caption,
    media: (post.social_post_media ?? []).map((m) => ({ media_type: m.media_type })),
  })
  if (invalid) return { success: false, error: invalid }

  // 1+2. Cancel any existing vendor schedule FIRST; abort on failure.
  const existing = post.external_ref?.vendorId
  if (existing) {
    try {
      await zernioAdapter.cancel(existing)
    } catch (e) {
      return { success: false, error: `Couldn't cancel the existing scheduled post — fix at the vendor before retrying. (${e instanceof Error ? e.message : 'error'})` }
    }
    await removeCropped(admin, post.external_ref?.croppedPaths)
    await admin.from('social_posts').update({ external_ref: null }).eq('id', id)
  }

  // 3. Crop + send, then commit the new external_ref.
  let result: PublishResult
  let croppedPaths: string[] = []
  try {
    const built = await buildMedia(admin, post)
    croppedPaths = built.croppedPaths
    const req = {
      caption: post.caption ?? '',
      media: built.media,
      platforms: post.platforms,
      format: post.format,
      scheduledFor: post.scheduled_at ?? undefined,
    }
    result = opts.now ? await zernioAdapter.publishNow(req) : await zernioAdapter.schedule(req)
  } catch (e) {
    await removeCropped(admin, croppedPaths)
    return { success: false, error: e instanceof Error ? e.message : 'Publish failed' }
  }

  await admin
    .from('social_posts')
    .update({
      external_ref: { vendorId: result.vendorId, croppedPaths },
      status: result.status === 'posted' ? 'posted' : 'scheduled',
      posted_at: result.status === 'posted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return { success: true }
}

/** Cancel a vendor schedule + clean up derivatives (used when un-scheduling/deleting). */
export async function cancelPost(id: string): Promise<void> {
  const admin = createSupabaseAdminClient()
  const post = await loadPost(admin, id)
  const vendorId = post?.external_ref?.vendorId
  if (vendorId) await zernioAdapter.cancel(vendorId)
  await removeCropped(admin, post?.external_ref?.croppedPaths)
  if (post) await admin.from('social_posts').update({ external_ref: null }).eq('id', id)
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

```bash
git add src/lib/publishing/publish-service.ts
git commit -m "feat(publishing): publish-service (crop pipeline, strict cancel-then-recreate, cleanup)"
```

---

### Task 7: `publishPost` server action

**Files:**
- Create: `src/app/actions/publish.ts`

- [ ] **Step 1: Write `src/app/actions/publish.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { sendPost, cancelPost } from '@/lib/publishing/publish-service'

// Publish (or schedule) a post that already exists in the DB. `now` posts
// immediately; otherwise it's scheduled at the post's scheduled_at.
export async function publishPost(id: string, opts: { now?: boolean } = {}) {
  const res = await sendPost(id, opts)
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return res
}

// Cancel a vendor schedule for a post (un-schedule / before delete).
export async function unpublishPost(id: string) {
  try {
    await cancelPost(id)
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Cancel failed' }
  }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add src/app/actions/publish.ts
git commit -m "feat(publishing): publishPost / unpublishPost server actions"
```

---

### Task 8: Integrate publishing into the post lifecycle (build milestone)

**Files:**
- Modify: `src/app/actions/social.ts` (`persist`, `reschedulePost`, `updatePostStatus`, `deleteSocialPost`)

The save path must trigger publishing when a post becomes `scheduled`, and cancel at the vendor when a scheduled post leaves that state or is removed.

- [ ] **Step 1: Import the publish service in `social.ts`**

At the top of `src/app/actions/social.ts`, add:

```typescript
import { sendPost, cancelPost } from '@/lib/publishing/publish-service'
```

- [ ] **Step 2: Trigger publish on save when status is `scheduled`**

In `persist()`, after the RPC succeeds and before the `return { success: true ... }`, add (using the returned post id `data`):

```typescript
  // Phase 2: a scheduled post is (re)sent to the vendor. sendPost does the
  // strict cancel-then-recreate internally if it was already scheduled.
  if (input.status === 'scheduled') {
    const pub = await sendPost(data as string, {})
    if (!pub.success) {
      // Leave the row saved but surface the publishing error to the caller.
      revalidatePath('/dashboard/social')
      return { success: false as const, error: pub.error ?? 'Could not schedule for publishing' }
    }
  } else if (input.id) {
    // Editing an existing post into a non-scheduled state: cancel any vendor schedule.
    await cancelPost(input.id)
  }
```

(Keep the existing `revalidatePath` + success return after this block.)

- [ ] **Step 3: Cancel/resend on reschedule**

In `reschedulePost`, after the successful DB update, add (re-send so the vendor gets the new time; sendPost cancels the old schedule first):

```typescript
  // Re-send to the vendor with the new time (cancels the old schedule first).
  const { data: row } = await supabase.from('social_posts').select('status').eq('id', id).maybeSingle()
  if ((row as { status?: string } | null)?.status === 'scheduled') {
    await sendPost(id, {})
  }
```

- [ ] **Step 4: Cancel on status-away-from-scheduled and on delete**

In `updatePostStatus`, after the successful update, add:

```typescript
  if (status !== 'scheduled') {
    await cancelPost(id)
  }
```

In `deleteSocialPost`, BEFORE deleting the row (after computing `paths` / removing bucket media), add:

```typescript
  // Cancel any vendor schedule + remove cropped derivatives.
  await cancelPost(id)
```

(`cancelPost` also removes `external_ref.croppedPaths`; the existing media removal stays.)

- [ ] **Step 5: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

```bash
git add src/app/actions/social.ts
git commit -m "feat(publishing): trigger schedule/cancel at vendor across save/reschedule/status/delete"
```

---

### Task 9: Zernio webhook (status sync) (build milestone)

**Files:**
- Create: `src/app/api/webhooks/zernio/route.ts`

- [ ] **Step 1: Write `src/app/api/webhooks/zernio/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { zernioWebhookSecret } from '@/lib/publishing/config'
import { sendPublishFailure } from '@/lib/email/send-publish-failure'
import { normalizeSettings, type ReminderSettings } from '@/lib/email/settings'

export const dynamic = 'force-dynamic'

const BUCKET = 'social-media'

function verify(raw: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', zernioWebhookSecret()).update(raw).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const sig = request.headers.get('x-zernio-signature') ?? request.headers.get('x-late-signature')
  if (!verify(raw, sig)) return new NextResponse('Invalid signature', { status: 401 })

  let payload: { event?: string; post?: { _id?: string; platforms?: { status?: string; error?: string }[] } }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad payload', { status: 400 })
  }

  const event = payload.event ?? ''
  const vendorId = payload.post?._id
  if (!vendorId) return NextResponse.json({ ok: true, ignored: 'no post id' })

  const admin = createSupabaseAdminClient()
  const { data: post } = await admin
    .from('social_posts')
    .select('id, title, caption, scheduled_at, external_ref')
    .filter('external_ref->>vendorId', 'eq', vendorId)
    .maybeSingle()
  if (!post) return NextResponse.json({ ok: true, ignored: 'no matching post' })

  const p = post as { id: string; title: string | null; caption: string | null; scheduled_at: string | null; external_ref: { croppedPaths?: string[] } | null }

  if (event === 'post.published' || event === 'post.partial') {
    await admin.from('social_posts').update({
      status: 'posted', posted_at: new Date().toISOString(), failure_reason: null, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    // cropped derivatives are no longer needed once published
    if (p.external_ref?.croppedPaths?.length) await admin.storage.from(BUCKET).remove(p.external_ref.croppedPaths)
    if (event === 'post.partial') {
      const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Partially published'
      await notifyFailure(admin, p, `Partially published: ${reason}`)
    }
  } else if (event === 'post.failed') {
    const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Publish failed'
    await admin.from('social_posts').update({
      status: 'failed', failure_reason: reason, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    await notifyFailure(admin, p, reason)
  }
  // post.cancelled / others: ignore (we initiated cancels ourselves)

  return NextResponse.json({ ok: true })
}

async function notifyFailure(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  post: { id: string; title: string | null; caption: string | null; scheduled_at: string | null },
  reason: string
) {
  try {
    const { data } = await admin.from('reminder_settings').select('*').eq('id', 1).maybeSingle()
    const settings = normalizeSettings(data as Partial<ReminderSettings> | null)
    const label = post.title?.trim() || post.caption?.trim() || 'Untitled post'
    await sendPublishFailure(settings.social_recipients, { label, reason, when: post.scheduled_at })
  } catch (e) {
    console.error('publish failure email failed:', e)
  }
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint`
Expected: clean. (Task 10 adds `send-publish-failure`; if building now, do Task 10 first or temporarily stub — but commit order here assumes Task 10 follows; run `pnpm build` at the end of Task 10.)

```bash
git add src/app/api/webhooks/zernio/route.ts
git commit -m "feat(publishing): signed Zernio webhook for status sync + cleanup"
```

---

### Task 10: Publish-failure email

**Files:**
- Create: `src/lib/email/send-publish-failure.ts`

- [ ] **Step 1: Write `src/lib/email/send-publish-failure.ts`**

```typescript
import { getResend } from "./resend"
import { EMAIL_FROM } from "./config"
import { emailShell } from "./shell"

const SOCIAL_URL = "https://wahlburgers-price-tracker.vercel.app/dashboard/social"

export function buildPublishFailureEmail(input: { label: string; reason: string; when: string | null }) {
  const subject = `⚠️ Social post failed to publish: ${input.label}`
  const whenLine = input.when
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" }).format(new Date(input.when))
    : "now"
  const html = emailShell({
    heading: "A scheduled post failed to publish",
    intro: `"${input.label}" (scheduled for ${whenLine}) didn't publish. Reason: ${input.reason}. Open the calendar to fix and reschedule.`,
    ctaLabel: "Open Social Calendar",
    ctaUrl: SOCIAL_URL,
    footer: "Automated publish-failure alert from WahlTools.",
  })
  const text = [
    `Social post failed to publish: ${input.label}`,
    `Scheduled for: ${whenLine}`,
    `Reason: ${input.reason}`,
    "",
    `Open the calendar: ${SOCIAL_URL}`,
    "",
    "— WahlTools",
  ].join("\n")
  return { subject, html, text }
}

export async function sendPublishFailure(
  to: string[],
  input: { label: string; reason: string; when: string | null }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildPublishFailureEmail(input)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds (webhook route + email now resolve together).

```bash
git add src/lib/email/send-publish-failure.ts
git commit -m "feat(publishing): Resend publish-failure alert email"
```

---

### Task 11: Daily reconcile + digest repurpose

**Files:**
- Modify: `src/app/api/cron/price-reminder/route.ts` (add reconcile block)
- Modify: `src/lib/email/send-social-reminder.ts` (copy: "overdue" → "needs attention")

- [ ] **Step 1: Add a reconcile block to the cron route**

In `src/app/api/cron/price-reminder/route.ts`, add imports:

```typescript
import { zernioAdapter } from "@/lib/publishing/zernio-client"
```

Then add a NEW independent block (its own try/catch), after the social-digest block and before the final `return`:

```typescript
  // Reconcile: catch any publish results the webhook missed. Checks scheduled
  // posts whose time has passed and that have a vendor id.
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min grace
    const { data: due } = await admin
      .from("social_posts")
      .select("id, external_ref, scheduled_at")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", cutoff)
    let reconciled = 0
    for (const row of (due ?? []) as { id: string; external_ref: { vendorId?: string } | null }[]) {
      const vendorId = row.external_ref?.vendorId
      if (!vendorId) continue
      try {
        const st = await zernioAdapter.getStatus(vendorId)
        if (st.status === "posted" || st.status === "partial") {
          await admin.from("social_posts").update({ status: "posted", posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id)
          reconciled++
        } else if (st.status === "failed") {
          await admin.from("social_posts").update({ status: "failed", failure_reason: st.error ?? "Publish failed", updated_at: new Date().toISOString() }).eq("id", row.id)
          reconciled++
        }
      } catch (e) {
        console.error("reconcile getStatus failed for", row.id, e)
      }
    }
    if (reconciled) actions.reconciled = reconciled
  } catch (error) {
    console.error("publish reconcile failed:", error)
    actions.reconcileError = true
  }
```

- [ ] **Step 2: Repurpose the digest copy**

In `src/lib/email/send-social-reminder.ts`, update the heading/intro so "overdue" reads as needs-attention. Change the `heading` to `"Social posts that need attention"` and the `intro` to:

```typescript
  const intro = "Posts scheduled for today, plus any past their time that haven't posted (these may have failed and need a look)."
```

(Keep the existing item rendering; `overdue: true` items now signify "needs attention.")

- [ ] **Step 3: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

```bash
git add src/app/api/cron/price-reminder/route.ts src/lib/email/send-social-reminder.ts
git commit -m "feat(publishing): daily reconcile of publish results + digest copy repurpose"
```

---

### Task 12: Social settings page (connection status)

**Files:**
- Create: `src/components/social/connection-status.tsx`
- Create: `src/app/(dashboard)/dashboard/social/settings/page.tsx`

- [ ] **Step 1: Write `src/components/social/connection-status.tsx`**

```tsx
import { Chip } from '@/components/ui/chip'
import { ZERNIO_BASE, zernioApiKey } from '@/lib/publishing/config'

// Server component: reads connected accounts from Zernio and shows status.
export async function ConnectionStatus() {
  let accounts: { platform: string; username?: string }[] = []
  let error: string | null = null
  try {
    const res = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${zernioApiKey()}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const body = (await res.json()) as { accounts?: typeof accounts } | typeof accounts
    accounts = Array.isArray(body) ? body : body.accounts ?? []
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not reach Zernio'
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Publishing not connected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set <code>ZERNIO_API_KEY</code> and connect Instagram + Facebook in the Zernio dashboard. ({error})
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium text-foreground">Connected accounts</p>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts connected yet — connect them in the Zernio dashboard.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Chip key={`${a.platform}-${a.username}`} tone="brand" label={`${a.platform}: @${a.username ?? 'connected'} ✓`} />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Scheduling a post here will <strong>auto-publish</strong> it at the set time.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/(dashboard)/dashboard/social/settings/page.tsx`**

```tsx
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ConnectionStatus } from '@/components/social/connection-status'

export const metadata = { title: 'Social Settings' }
export const dynamic = 'force-dynamic'

export default function SocialSettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Social Settings"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Settings' }]}
      />
      <div className="mt-6 max-w-xl">
        <ConnectionStatus />
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 3: Link it from the calendar header**

In `src/app/(dashboard)/dashboard/social/page.tsx`, add a settings `IconButton` next to the Queue one in the `PageHeader` `actions` (import `Settings` from lucide-react):

```tsx
        actions={
          <>
            <IconButton href="/dashboard/social/settings" label="Settings" icon={<Settings className="size-4" />} />
            <IconButton href="/dashboard/social/queue" label="Queue" icon={<ListChecks className="size-4" />} />
          </>
        }
```

- [ ] **Step 4: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds; `/dashboard/social/settings` in output.

```bash
git add "src/app/(dashboard)/dashboard/social/settings/page.tsx" src/components/social/connection-status.tsx "src/app/(dashboard)/dashboard/social/page.tsx"
git commit -m "feat(publishing): social settings page with connection status"
```

---

### Task 13: "Publish now" controls (build milestone)

**Files:**
- Modify: `src/components/social/post-composer-dialog.tsx` (Publish-now button)
- Modify: `src/components/social/post-context-menu.tsx` (add `onPublishNow`)
- Modify: `src/components/social/social-calendar.tsx` (wire publish-now + confirm)
- Modify: `src/components/social/queue-list.tsx` (publish-now row action)

- [ ] **Step 1: Composer — Publish now**

In `post-composer-dialog.tsx`: import `publishPost` from `@/app/actions/publish` and `Send` from lucide-react. Add a handler that saves first (to ensure an id) then publishes now:

```tsx
  async function handlePublishNow() {
    setSaving(true)
    setError(null)
    const input = { title, caption, format, status: post ? status : 'scheduled', scheduled_at: when ? new Date(when).toISOString() : null, platforms, productIds, retailers, media, aspect_ratio: aspectRatio }
    const saved = post ? await updateSocialPost(post.id, input) : await createSocialPost(input)
    if (!saved.success || !saved.data) { setSaving(false); setError(saved.error ?? 'Could not save'); toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: saved.error ?? 'Please try again.' }); return }
    const pub = await publishPost(saved.data, { now: true })
    setSaving(false)
    if (!pub.success) { setError(pub.error ?? 'Publish failed'); toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Publish failed', description: pub.error ?? 'Please try again.' }); return }
    toast({ icon: <Send className="size-5 text-brand" />, title: 'Publishing now', description: `"${postLabel({ title, caption })}"` })
    onOpenChange(false)
    onSaved()
  }
```

Add a **Publish now** button in the footer (left of Cancel), gated behind a confirm. Add `const [confirmPublish, setConfirmPublish] = useState(false)`; the button sets it true; render a `ConfirmDialog` (sibling, like the delete one) with `title="Publish now?"`, `description="This posts to Instagram/Facebook immediately."`, `confirmLabel="Publish now"`, `onConfirm={() => { setConfirmPublish(false); handlePublishNow() }}`. Import `ConfirmDialog` and `postLabel`.

- [ ] **Step 2: Context menu — add Publish now**

In `post-context-menu.tsx`, add an `onPublishNow: () => void` prop and a menu item at the top (before Edit):

```tsx
        <ContextMenuItem onSelect={onPublishNow}>Publish now</ContextMenuItem>
        <ContextMenuSeparator />
```

- [ ] **Step 3: Calendar — wire publish-now with confirm**

In `social-calendar.tsx`: import `publishPost` from `@/app/actions/publish` and `Send` from lucide-react. Add state `const [publishPostRec, setPublishPostRec] = useState<SocialPostRecord | null>(null)` and `const [publishLoading, setPublishLoading] = useState(false)`. Add to the `<PostContextMenu>` props: `onPublishNow={() => setPublishPostRec(p)}`. Add a handler + a second `ConfirmDialog`:

```tsx
  async function performPublishNow() {
    if (!publishPostRec) return
    const post = publishPostRec
    setPublishLoading(true)
    const res = await publishPost(post.id, { now: true })
    setPublishLoading(false)
    setPublishPostRec(null)
    toast(res.success
      ? { icon: <Send className="size-5 text-brand" />, title: 'Publishing now', description: `"${postLabel(post)}"` }
      : { variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Publish failed', description: res.error ?? 'Please try again.' })
    router.refresh()
  }
```

```tsx
      <ConfirmDialog
        open={!!publishPostRec}
        onOpenChange={(v) => { if (!v) setPublishPostRec(null) }}
        title="Publish now?"
        description={publishPostRec ? `"${postLabel(publishPostRec)}" will post to Instagram/Facebook immediately.` : ''}
        confirmLabel="Publish now"
        loading={publishLoading}
        onConfirm={performPublishNow}
      />
```

- [ ] **Step 4: Queue — Publish now row action**

In `queue-list.tsx`, add `publishPost` import + `Send` icon, a `publishPostRec`/`publishLoading` state, a `performPublishNow` (same shape as Step 3), a `ConfirmDialog` (same as Step 3), and a row action `{ label: 'Publish now', onSelect: () => setPublishPostRec(p) }` as the first item in the `actions` array.

- [ ] **Step 5: Verify + commit**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

```bash
git add src/components/social/post-composer-dialog.tsx src/components/social/post-context-menu.tsx src/components/social/social-calendar.tsx src/components/social/queue-list.tsx
git commit -m "feat(publishing): Publish-now controls (composer, right-click, queue) with confirm"
```

---

### Task 14: Migration (reconcile index)

**Files:**
- Create: `migrations/22_social_publishing.sql`

- [ ] **Step 1: Write `migrations/22_social_publishing.sql`**

```sql
-- Migration 22: support live publishing.
-- Run this in the Supabase SQL Editor.
-- No new columns (reuses status/posted_at/failure_reason/external_ref, and the
-- existing social-media bucket for published/ derivatives). This adds a partial
-- index that speeds the daily reconcile query (scheduled posts past their time).

create index if not exists social_posts_scheduled_pending_idx
  on social_posts (scheduled_at)
  where status = 'scheduled';
```

- [ ] **Step 2: Commit**

```bash
git add migrations/22_social_publishing.sql
git commit -m "feat(publishing): reconcile-query index migration"
```

- [ ] **Step 3: Apply manually** in the Supabase SQL editor (not required for build).

---

### Task 15: Final verification

**Files:** none.

- [ ] **Step 1: Full build**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds; `/dashboard/social/settings` and `/api/webhooks/zernio` present.

- [ ] **Step 2: Live setup (manual, by the user)**

Create the Zernio account; connect Instagram + Facebook; set `ZERNIO_API_KEY` + `ZERNIO_WEBHOOK_SECRET` in Vercel; register the webhook at `https://wahlburgers-price-tracker.vercel.app/api/webhooks/zernio` for events `post.published`, `post.failed`, `post.partial`, with the secret.

- [ ] **Step 3: Manual smoke (with creds, on preview/prod)**

1. Settings page shows "Connected: instagram / facebook ✓".
2. Create a post (1 image, ratio 4:5), schedule ~3 min out → it publishes; webhook flips it to **posted**; the cropped image posts at 4:5.
3. "Publish now" on a draft posts immediately.
4. Edit a scheduled post's time → confirm only one post publishes (old vendor schedule cancelled).
5. Delete a scheduled post → vendor schedule cancelled (no post fires).
6. Force a failure (e.g. invalid media) → status **failed** + failure email to `social_recipients`.
7. Light + dark render on settings + publish controls.

---

## Self-Review

**Spec coverage:** vendor=Zernio (Tasks 1,5); vendor-owned scheduling via `scheduledFor` (Task 5,6); webhook + daily reconcile (Tasks 9,11); one-time setup + in-app status (Task 12,15); scheduled + publish-now (Tasks 6,7,13); pre-crop with sharp (Tasks 4,6); failure alerts (Tasks 9,10); digest repurpose (Task 11); strict cancel-then-recreate (Task 6 `sendPost`); external_ref shape `{vendorId,croppedPaths}` (Tasks 6,8,9); per-format rules (Task 3); env + sharp (Task 1); migration (Task 14). All spec sections map to tasks.

**Placeholder scan:** No TBD/TODO. The Task 5 "live-doc note" is a verification instruction (endpoints are concrete from the Zernio reference), not a placeholder. UI edits (Task 13) give full handler code + exact placement.

**Type consistency:** `PublishRequest`/`PublishResult`/`PublishStatus`/`PublishAdapter` (Task 2) are used consistently by `zernio-client` (Task 5) and `publish-service` (Task 6). `sendPost(id,{now})`/`cancelPost(id)` (Task 6) match their callers in `publish.ts` (Task 7) and `social.ts` (Task 8). `external_ref` `{vendorId,croppedPaths}` is read/written consistently in Tasks 6, 8, 9, 11. `validateForPublish` (Task 3) input shape matches the call in Task 6. `sendPublishFailure(to,{label,reason,when})` (Task 10) matches the webhook call (Task 9). `postLabel` (from v1 config) reused in Task 13.
```

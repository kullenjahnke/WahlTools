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
  collaborators: string[] | null
  aspect_ratio: string
  scheduled_at: string | null
  external_ref: { vendorId?: string; croppedPaths?: string[] } | null
  social_post_media: DbMedia[] | null
}

const POST_SELECT =
  'id, caption, format, platforms, collaborators, aspect_ratio, scheduled_at, external_ref, ' +
  'social_post_media ( url, storage_path, media_type, position )'

async function loadPost(admin: ReturnType<typeof createSupabaseAdminClient>, id: string): Promise<DbPost | null> {
  const { data } = await admin.from('social_posts').select(POST_SELECT).eq('id', id).maybeSingle()
  return (data as unknown as DbPost) ?? null
}

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

  let result: PublishResult
  let croppedPaths: string[] = []
  try {
    const built = await buildMedia(admin, post)
    croppedPaths = built.croppedPaths
    const req = {
      caption: post.caption ?? '',
      media: built.media,
      platforms: post.platforms,
      collaborators: post.collaborators ?? [],
      format: post.format,
      scheduledFor: post.scheduled_at ?? undefined,
    }
    result = opts.now ? await zernioAdapter.publishNow(req) : await zernioAdapter.schedule(req)
  } catch (e) {
    await removeCropped(admin, croppedPaths)
    return { success: false, error: e instanceof Error ? e.message : 'Publish failed' }
  }

  const { error: saveErr } = await admin
    .from('social_posts')
    .update({
      external_ref: { vendorId: result.vendorId, croppedPaths },
      status: result.status === 'posted' ? 'posted' : 'scheduled',
      posted_at: result.status === 'posted' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (saveErr) {
    // The vendor accepted the post but we couldn't record it. Compensate by
    // cancelling the vendor post so we never have an untracked live/scheduled post.
    try { await zernioAdapter.cancel(result.vendorId) } catch { /* best-effort */ }
    await removeCropped(admin, croppedPaths)
    return { success: false, error: 'Published to the vendor but failed to save locally; cancelled to avoid an untracked post. Please retry.' }
  }

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

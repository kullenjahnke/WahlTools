'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendPost, cancelPost } from '@/lib/publishing/publish-service'
import { RETAILERS } from '@/lib/config/retailers'
import { SOCIAL_STATUS_VALUES, SOCIAL_FORMAT_VALUES, SOCIAL_ASPECT_RATIO_VALUES, isValidPlatform } from '@/lib/config/social'

const BUCKET = 'social-media'

export interface SocialPostInput {
  id?: string
  title?: string | null
  caption?: string | null
  format: string
  aspect_ratio: string
  status: string
  scheduled_at?: string | null
  platforms: string[]
  notes?: string | null
  productIds: string[]
  retailers: string[]
  media: { url: string; storage_path: string; media_type: string; position: number }[]
}

function validate(input: SocialPostInput): string | null {
  if (!SOCIAL_FORMAT_VALUES.includes(input.format as never)) return 'Invalid format'
  if (!SOCIAL_ASPECT_RATIO_VALUES.includes(input.aspect_ratio as never)) return 'Invalid aspect ratio'
  if (!SOCIAL_STATUS_VALUES.includes(input.status as never)) return 'Invalid status'
  if (!input.platforms.every(isValidPlatform)) return 'Invalid platform'
  if (!input.retailers.every((r) => (RETAILERS as readonly string[]).includes(r))) return 'Invalid retailer'
  if (input.status === 'scheduled' && !input.scheduled_at) return 'Scheduled posts need a date/time'
  return null
}

async function persist(input: SocialPostInput) {
  const supabase = await createSupabaseServerClient()
  const invalid = validate(input)
  if (invalid) return { success: false as const, error: invalid }

  const { data, error } = await supabase.rpc('save_social_post', {
    p_post: {
      id: input.id ?? null,
      title: input.title ?? null,
      caption: input.caption ?? null,
      format: input.format,
      aspect_ratio: input.aspect_ratio,
      status: input.status,
      scheduled_at: input.scheduled_at ?? null,
      platforms: input.platforms,
      notes: input.notes ?? null,
    },
    p_product_ids: input.productIds,
    p_retailers: input.retailers,
    p_media: input.media,
  })

  if (error) {
    console.error('save_social_post failed:', error)
    return { success: false as const, error: 'Failed to save post' }
  }

  // Phase 2: a scheduled post is (re)sent to the vendor. sendPost does the
  // strict cancel-then-recreate internally if it was already scheduled.
  if (input.status === 'scheduled') {
    const pub = await sendPost(data as string, {})
    if (!pub.success) {
      await supabase.from('social_posts').update({ status: 'draft' }).eq('id', data as string)
      revalidatePath('/dashboard/social')
      revalidatePath('/dashboard/social/queue')
      return { success: false as const, error: pub.error ?? 'Could not schedule for publishing' }
    }
  } else if (input.id) {
    // Editing an existing post into a non-scheduled state: cancel any vendor schedule (best-effort).
    try { await cancelPost(input.id) } catch (e) { console.error('cancelPost on save failed:', e) }
  }

  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const, data: data as string }
}

export async function createSocialPost(input: SocialPostInput) {
  return persist({ ...input, id: undefined })
}

export async function updateSocialPost(id: string, input: SocialPostInput) {
  return persist({ ...input, id })
}

export async function reschedulePost(id: string, scheduledAt: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('social_posts')
    .update({ scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false as const, error: 'Failed to reschedule' }

  // Re-send to the vendor with the new time (sendPost cancels the old schedule first).
  const { data: rrow } = await supabase.from('social_posts').select('status').eq('id', id).maybeSingle()
  if ((rrow as { status?: string } | null)?.status === 'scheduled') {
    const pub = await sendPost(id, {})
    if (!pub.success) return { success: false as const, error: pub.error ?? 'Could not reschedule at vendor' }
  }

  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

export async function updatePostStatus(id: string, status: string) {
  const supabase = await createSupabaseServerClient()
  if (!SOCIAL_STATUS_VALUES.includes(status as never)) return { success: false as const, error: 'Invalid status' }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'posted') patch.posted_at = new Date().toISOString()
  if (status !== 'posted') patch.posted_at = null
  const { error } = await supabase.from('social_posts').update(patch).eq('id', id)
  if (error) return { success: false as const, error: 'Failed to update status' }

  if (status !== 'scheduled') {
    try { await cancelPost(id) } catch (e) { console.error('cancelPost on status change failed:', e) }
  }

  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

export async function deleteSocialPost(id: string) {
  const supabase = await createSupabaseServerClient()

  // Cancel any vendor schedule + remove cropped derivatives. Best-effort: a
  // vendor error shouldn't block deleting locally (note: an orphaned vendor
  // schedule could still publish — surfaced via the daily reconcile/logs).
  try { await cancelPost(id) } catch (e) { console.error('cancelPost on delete failed:', e) }

  const { data: media } = await supabase.from('social_post_media').select('storage_path').eq('post_id', id)
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) return { success: false as const, error: 'Failed to delete post' }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

/** Server-side image upload (<=5MB, enforced by the server-action body limit). */
export async function uploadSocialImage(formData: FormData) {
  const supabase = await createSupabaseServerClient()
  const file = formData.get('file') as File | null
  if (!file) return { success: false as const, error: 'No file' }
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) return { success: false as const, error: 'Upload failed' }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { success: true as const, data: { url: publicUrl, storage_path: path, media_type: 'image' as const } }
}

/** Signed URL for direct-to-storage video upload (bypasses the 5MB body limit). */
export async function createSocialVideoUploadUrl(filename: string) {
  const supabase = await createSupabaseServerClient()
  const ext = filename.split('.').pop() || 'mp4'
  const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false as const, error: 'Could not create upload URL' }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { success: true as const, data: { token: data.token, path: data.path, url: publicUrl } }
}

export async function duplicateSocialPost(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data: post, error } = await supabase
    .from('social_posts')
    .select(
      'title, caption, format, platforms, aspect_ratio, notes, ' +
      'social_post_media ( url, storage_path, media_type, position ), ' +
      'social_post_products ( product_id ), ' +
      'social_post_retailers ( retailer )'
    )
    .eq('id', id)
    .maybeSingle()
  if (error || !post) return { success: false as const, error: 'Post not found' }

  type Src = {
    title: string | null
    caption: string | null
    format: string
    platforms: string[]
    aspect_ratio: string
    notes: string | null
    social_post_media: { url: string; storage_path: string; media_type: string; position: number }[] | null
    social_post_products: { product_id: string }[] | null
    social_post_retailers: { retailer: string }[] | null
  }
  const src = post as unknown as Src

  // Copy each media object to a fresh path so deleting one post never removes
  // the other's files.
  const media: { url: string; storage_path: string; media_type: string; position: number }[] = []
  for (const m of src.social_post_media ?? []) {
    const ext = m.storage_path.split('.').pop() || 'bin'
    const newPath = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
    const { error: copyErr } = await supabase.storage.from(BUCKET).copy(m.storage_path, newPath)
    if (copyErr) continue
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(newPath)
    media.push({ url: publicUrl, storage_path: newPath, media_type: m.media_type, position: m.position })
  }

  const baseLabel = src.title?.trim() || src.caption?.trim()?.slice(0, 40) || 'post'
  const { error: rpcErr } = await supabase.rpc('save_social_post', {
    p_post: {
      id: null,
      title: `Copy of ${baseLabel}`,
      caption: src.caption,
      format: src.format,
      status: 'draft',
      scheduled_at: null,
      platforms: src.platforms,
      notes: src.notes,
      aspect_ratio: src.aspect_ratio,
    },
    p_product_ids: (src.social_post_products ?? []).map((p) => p.product_id),
    p_retailers: (src.social_post_retailers ?? []).map((r) => r.retailer),
    p_media: media,
  })
  if (rpcErr) {
    console.error('duplicate save_social_post failed:', rpcErr)
    return { success: false as const, error: 'Failed to duplicate post' }
  }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

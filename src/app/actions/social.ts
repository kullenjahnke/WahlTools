'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

export async function deleteSocialPost(id: string) {
  const supabase = await createSupabaseServerClient()
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

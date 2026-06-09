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

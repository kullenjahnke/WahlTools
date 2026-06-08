import type { SupabaseClient } from '@supabase/supabase-js'

// Shape returned to the calendar/queue UIs. Tags are flattened for display.
export interface SocialPostMedia {
  id: string
  url: string
  storage_path: string
  media_type: 'image' | 'video'
  position: number
}

export interface SocialPostRecord {
  id: string
  caption: string | null
  format: 'image' | 'carousel' | 'reel' | 'story'
  status: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
  scheduled_at: string | null
  posted_at: string | null
  platforms: string[]
  notes: string | null
  created_at: string
  updated_at: string
  media: SocialPostMedia[]
  product_ids: string[]
  product_names: string[]
  retailers: string[]
}

const SELECT = `
  id, caption, format, status, scheduled_at, posted_at, platforms, notes, created_at, updated_at,
  social_post_media ( id, url, storage_path, media_type, position ),
  social_post_products ( product_id, products ( name ) ),
  social_post_retailers ( retailer )
`

type RawRow = {
  id: string
  caption: string | null
  format: SocialPostRecord['format']
  status: SocialPostRecord['status']
  scheduled_at: string | null
  posted_at: string | null
  platforms: string[]
  notes: string | null
  created_at: string
  updated_at: string
  social_post_media: SocialPostMedia[] | null
  social_post_products: { product_id: string; products: { name: string } | null }[] | null
  social_post_retailers: { retailer: string }[] | null
}

function shape(row: RawRow): SocialPostRecord {
  const products = row.social_post_products ?? []
  return {
    id: row.id,
    caption: row.caption,
    format: row.format,
    status: row.status,
    scheduled_at: row.scheduled_at,
    posted_at: row.posted_at,
    platforms: row.platforms ?? [],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media: (row.social_post_media ?? []).sort((a, b) => a.position - b.position),
    product_ids: products.map((p) => p.product_id),
    product_names: products.map((p) => p.products?.name ?? 'Unknown'),
    retailers: (row.social_post_retailers ?? []).map((r) => r.retailer),
  }
}

/** Posts whose scheduled_at falls within [startIso, endIso). For the calendar. */
export async function getPostsInRange(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<SocialPostRecord[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(SELECT)
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as RawRow[]).map(shape)
}

/** All posts (scheduled + unscheduled ideas). For the queue. */
export async function getAllPosts(supabase: SupabaseClient): Promise<SocialPostRecord[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(SELECT)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawRow[]).map(shape)
}


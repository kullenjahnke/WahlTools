import type { SupabaseClient } from "@supabase/supabase-js"
import { RETAILERS } from "@/lib/config/retailers"

const MS_PER_DAY = 86400000

export interface StaleRetailer {
  retailer: string
  /** Days since the retailer's most recent price update; null = never. */
  days: number | null
}

export interface NAProductEntry {
  product: string
  retailer: string
}

// Retailers whose most recent price update is older than `thresholdDays`
// (or that have no prices at all).
export async function getStaleRetailers(
  admin: SupabaseClient,
  thresholdDays: number
): Promise<StaleRetailer[]> {
  const { data, error } = await admin.from("prices").select("retailer, timestamp")
  if (error) throw error

  const latest = new Map<string, number>()
  for (const row of (data ?? []) as { retailer: string; timestamp: string }[]) {
    const t = new Date(row.timestamp).getTime()
    if (Number.isNaN(t)) continue
    const cur = latest.get(row.retailer)
    if (cur == null || t > cur) latest.set(row.retailer, t)
  }

  const now = Date.now()
  const stale: StaleRetailer[] = []
  for (const retailer of RETAILERS) {
    const t = latest.get(retailer)
    if (t == null) {
      stale.push({ retailer, days: null })
      continue
    }
    const days = Math.floor((now - t) / MS_PER_DAY)
    if (days > thresholdDays) stale.push({ retailer, days })
  }
  return stale
}

// Products marked N/A (price 0, not sold out) within the last `days`.
export async function getRecentNAProducts(
  admin: SupabaseClient,
  days: number
): Promise<NAProductEntry[]> {
  const cutoff = new Date(Date.now() - days * MS_PER_DAY).toISOString()
  const { data, error } = await admin
    .from("prices")
    .select("product_id, retailer, price, is_sold_out, status, timestamp, products(name)")
    .gte("timestamp", cutoff)
    .order("timestamp", { ascending: false })
  if (error) throw error

  const seen = new Set<string>()
  const items: NAProductEntry[] = []
  for (const row of (data ?? []) as Array<{
    product_id: string
    retailer: string
    price: number | null
    is_sold_out: boolean | null
    status: string | null
    products: { name: string } | { name: string }[] | null
  }>) {
    const soldOut = row.status === "out_of_stock" || row.is_sold_out === true
    const na = !soldOut && (row.price == null || row.price <= 0)
    if (!na) continue
    const key = `${row.product_id}|${row.retailer}`
    if (seen.has(key)) continue
    seen.add(key)
    const name = Array.isArray(row.products) ? row.products[0]?.name : row.products?.name
    items.push({ product: name ?? "Unknown product", retailer: row.retailer })
  }
  return items
}

export interface SocialPostReminderEntry {
  caption: string
  when: string
  overdue: boolean
}

// Posts scheduled for "today" (America/Detroit) plus any still-'scheduled'
// post whose time has already passed (overdue). For the daily social digest.
export async function getUpcomingAndOverduePosts(
  admin: SupabaseClient
): Promise<SocialPostReminderEntry[]> {
  const nowMs = Date.now()
  const todayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const { data, error } = await admin
    .from('social_posts')
    .select('title, caption, scheduled_at, status')
    .in('status', ['scheduled', 'failed'])
    .order('scheduled_at', { ascending: true })
  if (error) throw error

  const fmtDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const fmtTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', hour: 'numeric', minute: '2-digit',
  })

  const out: SocialPostReminderEntry[] = []
  for (const row of (data ?? []) as { title: string | null; caption: string | null; scheduled_at: string | null; status: string }[]) {
    if (row.status === 'failed') {
      out.push({
        caption: row.title?.trim() || row.caption?.trim() || 'Untitled post',
        when: row.scheduled_at ? `${fmtDay.format(new Date(row.scheduled_at))} ${fmtTime.format(new Date(row.scheduled_at))}` : 'Unknown',
        overdue: true,
      })
      continue
    }
    if (!row.scheduled_at) continue
    const t = new Date(row.scheduled_at)
    const isToday = fmtDay.format(t) === todayYmd
    const overdue = t.getTime() < nowMs && !isToday
    if (isToday || overdue) {
      out.push({
        caption: row.title?.trim() || row.caption?.trim() || 'Untitled post',
        when: `${fmtDay.format(t)} ${fmtTime.format(t)}`,
        overdue,
      })
    }
  }
  return out
}

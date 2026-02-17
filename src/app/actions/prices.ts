// src/app/actions/prices.ts
'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { RETAILERS } from "@/lib/config/retailers"

export async function fetchLatestPrices(productIds?: string[]) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Start with the base query
    let query = supabase
      .from('prices')
      .select(`
        id,
        product_id,
        retailer,
        price,
        timestamp,
        status,
        is_promotion,
        promotion_notes,
        created_by,
        updated_by,
        products (
          id,
          name,
          category,
          aliases
        )
      `)
      .eq('status', 'active')
    
    // Filter by product IDs if provided
    if (productIds && productIds.length > 0) {
      query = query.in('product_id', productIds)
    }

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('Error fetching latest prices:', error)
      throw new Error('Failed to fetch price data')
    }

    return data
  } catch (error) {
    console.error('Price fetching error:', error)
    throw error
  }
}

export async function fetchProductPriceHistory(productId: string, days: number = 90) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Calculate date cutoff
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffString = cutoffDate.toISOString()
    
    const { data, error } = await supabase
      .from('prices')
      .select(`
        id,
        product_id,
        retailer,
        price,
        timestamp,
        status,
        is_promotion,
        promotion_notes
      `)
      .eq('product_id', productId)
      .gte('timestamp', cutoffString)
      .order('timestamp', { ascending: true })
      .limit(1000)
    
    if (error) {
      console.error('Error fetching price history:', error)
      throw new Error('Failed to fetch price history')
    }

    return data
  } catch (error) {
    console.error('Price history error:', error)
    throw error
  }
}

/**
 * Get the Monday 00:00:00 start of a week in America/New_York timezone.
 * Returns a UTC Date object representing that moment.
 */
function getWeekStartEST(date: Date): Date {
  // Format the date in EST to get the local day-of-week
  const estParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => estParts.find(p => p.type === type)?.value || ''
  const weekday = get('weekday')
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[weekday] ?? 0

  // Build the Monday date in EST
  const estYear = parseInt(get('year'))
  const estMonth = parseInt(get('month')) - 1
  const estDay = parseInt(get('day')) - dayOffset

  // Create a date string representing Monday 00:00:00 EST
  const mondayEST = new Date(Date.UTC(estYear, estMonth, estDay, 5, 0, 0)) // EST = UTC-5
  // Check if EDT (UTC-4) — approximate: Mar second Sun to Nov first Sun
  const month = mondayEST.getUTCMonth()
  if (month >= 2 && month <= 10) {
    // Potentially EDT, adjust to UTC-4
    mondayEST.setUTCHours(4)
  }

  return mondayEST
}

export async function getPriceChangeStats() {
  try {
    const supabase = await createSupabaseServerClient()

    const now = new Date()
    const currentWeekStart = getWeekStartEST(now)
    const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Fetch active prices for distinct product count, and prices from both weeks for WoW
    const [{ data: activePrices }, { data: twoWeekPrices }] = await Promise.all([
      supabase
        .from('prices')
        .select('retailer, product_id')
        .eq('status', 'active'),
      supabase
        .from('prices')
        .select('retailer, product_id, price, timestamp')
        .gte('timestamp', prevWeekStart.toISOString())
        .order('timestamp', { ascending: false })
    ])

    // Count DISTINCT products per retailer (not price log count)
    const distinctProductsByRetailer: Record<string, Set<string>> = {}
    for (const p of activePrices || []) {
      if (!distinctProductsByRetailer[p.retailer]) {
        distinctProductsByRetailer[p.retailer] = new Set()
      }
      distinctProductsByRetailer[p.retailer].add(p.product_id)
    }

    // Group prices by retailer+product, split into current/prev week
    // Use latest price per product per retailer per week as representative
    const currentWeekPrices: Record<string, number> = {} // key: retailer::product_id
    const prevWeekPrices: Record<string, number> = {}

    for (const p of twoWeekPrices || []) {
      if (p.price === 0) continue // Skip sold-out/not-available entries
      const ts = new Date(p.timestamp)
      const key = `${p.retailer}::${p.product_id}`

      if (ts >= currentWeekStart) {
        // Current week — first occurrence is latest (ordered desc)
        if (!(key in currentWeekPrices)) {
          currentWeekPrices[key] = p.price
        }
      } else if (ts >= prevWeekStart) {
        // Previous week
        if (!(key in prevWeekPrices)) {
          prevWeekPrices[key] = p.price
        }
      }
    }

    // Calculate WoW changes per retailer
    const changesByRetailer: Record<string, { increases: number; decreases: number; unchanged: number }> = {}

    for (const key of Object.keys(currentWeekPrices)) {
      const retailer = key.split('::')[0]
      if (!changesByRetailer[retailer]) {
        changesByRetailer[retailer] = { increases: 0, decreases: 0, unchanged: 0 }
      }

      if (key in prevWeekPrices) {
        const change = (currentWeekPrices[key] - prevWeekPrices[key]) / prevWeekPrices[key]
        if (change > 0.001) {
          changesByRetailer[retailer].increases++
        } else if (change < -0.001) {
          changesByRetailer[retailer].decreases++
        } else {
          changesByRetailer[retailer].unchanged++
        }
      } else {
        // No previous week data — count as unchanged
        changesByRetailer[retailer].unchanged++
      }
    }

    return RETAILERS.map(retailer => {
      const totalProducts = distinctProductsByRetailer[retailer]?.size || 0
      const changes = changesByRetailer[retailer] || { increases: 0, decreases: 0, unchanged: 0 }
      return {
        retailer,
        totalProducts,
        increases: changes.increases,
        decreases: changes.decreases,
        unchanged: changes.unchanged
      }
    })
  } catch (error) {
    console.error('Error fetching price stats:', error instanceof Error ? error.message : 'Unknown error')
    return RETAILERS.map(retailer => ({
      retailer,
      totalProducts: 0,
      increases: 0,
      decreases: 0,
      unchanged: 0
    }))
  }
}

export async function recordPriceCheck(
  retailer: string,
  prices: { productId: string, price: number, isPromotion?: boolean, promotionNotes?: string }[]
) {
  try {
    const supabase = await createSupabaseServerClient()

    // Build JSONB array for the RPC function
    const priceData = prices.map(p => ({
      product_id: p.productId,
      price: p.price,
      is_promotion: p.isPromotion || false,
      promotion_notes: p.promotionNotes || null,
    }))

    // Single atomic transaction via database function
    const { error } = await supabase.rpc('record_price_check', {
      p_retailer: retailer,
      p_prices: priceData,
      p_notes: `Price check - ${prices.length} products updated`
    })

    if (error) throw error

    revalidatePath('/dashboard/prices')
    revalidatePath('/dashboard/prices/history')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (error) {
    console.error('Error recording price check:', error)
    throw error
  }
}
// src/app/actions/prices.ts
'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { RETAILERS } from "@/lib/config/retailers"

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

    // Calculate WoW changes per retailer using 6 percentage buckets
    const changesByRetailer: Record<string, {
      downOver10: number; down5to10: number; down0to5: number;
      up0to5: number; up5to10: number; upOver10: number;
    }> = {}

    for (const key of Object.keys(currentWeekPrices)) {
      const retailer = key.split('::')[0]
      if (!changesByRetailer[retailer]) {
        changesByRetailer[retailer] = {
          downOver10: 0, down5to10: 0, down0to5: 0,
          up0to5: 0, up5to10: 0, upOver10: 0,
        }
      }

      // Only include products that have data in both weeks
      if (!(key in prevWeekPrices)) continue

      const changePct = ((currentWeekPrices[key] - prevWeekPrices[key]) / prevWeekPrices[key]) * 100

      if (changePct < -10) {
        changesByRetailer[retailer].downOver10++
      } else if (changePct < -5) {
        changesByRetailer[retailer].down5to10++
      } else if (changePct < -0.1) {
        changesByRetailer[retailer].down0to5++
      } else if (changePct <= 0.1) {
        changesByRetailer[retailer].up0to5++ // effectively unchanged — bucket with smallest increases
      } else if (changePct <= 5) {
        changesByRetailer[retailer].up0to5++
      } else if (changePct <= 10) {
        changesByRetailer[retailer].up5to10++
      } else {
        changesByRetailer[retailer].upOver10++
      }
    }

    return RETAILERS.map(retailer => {
      const totalProducts = distinctProductsByRetailer[retailer]?.size || 0
      const changes = changesByRetailer[retailer] || {
        downOver10: 0, down5to10: 0, down0to5: 0,
        up0to5: 0, up5to10: 0, upOver10: 0,
      }
      return {
        retailer,
        totalProducts,
        ...changes,
      }
    })
  } catch (error) {
    console.error('Error fetching price stats:', error instanceof Error ? error.message : 'Unknown error')
    return RETAILERS.map(retailer => ({
      retailer,
      totalProducts: 0,
      downOver10: 0, down5to10: 0, down0to5: 0,
      up0to5: 0, up5to10: 0, upOver10: 0,
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
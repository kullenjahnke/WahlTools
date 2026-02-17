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

export async function getPriceChangeStats() {
  try {
    const supabase = await createSupabaseServerClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Two queries instead of 22 (was 2 per retailer)
    const [{ data: activePrices }, { data: priceHistory }] = await Promise.all([
      supabase
        .from('prices')
        .select('retailer, id')
        .eq('status', 'active'),
      supabase
        .from('prices')
        .select('retailer, product_id, price, timestamp')
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: true })
    ])

    // Count active prices per retailer
    const activeCountByRetailer: Record<string, number> = {}
    for (const p of activePrices || []) {
      activeCountByRetailer[p.retailer] = (activeCountByRetailer[p.retailer] || 0) + 1
    }

    // Group history by retailer+product and count increases/decreases
    const changesByRetailer: Record<string, { increases: number; decreases: number }> = {}
    const grouped: Record<string, { price: number }[]> = {}

    for (const p of priceHistory || []) {
      const key = `${p.retailer}::${p.product_id}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({ price: p.price })
    }

    for (const [key, prices] of Object.entries(grouped)) {
      const retailer = key.split('::')[0]
      if (!changesByRetailer[retailer]) {
        changesByRetailer[retailer] = { increases: 0, decreases: 0 }
      }
      for (let i = 1; i < prices.length; i++) {
        if (prices[i].price > prices[i - 1].price) {
          changesByRetailer[retailer].increases++
        } else if (prices[i].price < prices[i - 1].price) {
          changesByRetailer[retailer].decreases++
        }
      }
    }

    return RETAILERS.map(retailer => {
      const totalProducts = activeCountByRetailer[retailer] || 0
      const changes = changesByRetailer[retailer] || { increases: 0, decreases: 0 }
      return {
        retailer,
        totalProducts,
        increases: changes.increases,
        decreases: changes.decreases,
        unchanged: Math.max(0, totalProducts - changes.increases - changes.decreases)
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
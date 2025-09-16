// src/app/actions/prices.ts
'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { RETAILERS } from "@/lib/config/retailers"
import { getCurrentUserEmail } from "@/lib/auth/get-user"

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
    
    const { data, error } = await query

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
    
    // For each retailer, gather stats
    const stats = await Promise.all(
      RETAILERS.map(async (retailer) => {
        // Get latest active prices for this retailer
        const { data: latestPrices, error: latestError } = await supabase
          .from('prices')
          .select('id, price')
          .eq('retailer', retailer)
          .eq('status', 'active')
        
        if (latestError) throw latestError
        
        // Get price changes for this retailer in the last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        // Get all prices for this retailer in the last 30 days
        const { data: priceHistory, error: historyError } = await supabase
          .from('prices')
          .select('product_id, price, timestamp')
          .eq('retailer', retailer)
          .gte('timestamp', thirtyDaysAgo.toISOString())
          .order('timestamp', { ascending: true })
        
        let increases = 0
        let decreases = 0
        
        if (!historyError && priceHistory) {
          // Group prices by product_id
          const pricesByProduct = priceHistory.reduce((acc, curr) => {
            if (!acc[curr.product_id]) {
              acc[curr.product_id] = []
            }
            acc[curr.product_id].push(curr)
            return acc
          }, {} as Record<string, typeof priceHistory>)
          
          // Count price changes for each product
          Object.values(pricesByProduct).forEach(prices => {
            if (prices.length < 2) return
            
            // Compare each consecutive price
            for (let i = 1; i < prices.length; i++) {
              if (prices[i].price > prices[i-1].price) {
                increases++
              } else if (prices[i].price < prices[i-1].price) {
                decreases++
              }
            }
          })
        }
        
        return {
          retailer,
          totalProducts: latestPrices?.length || 0,
          increases,
          decreases,
          unchanged: (latestPrices?.length || 0) - increases - decreases
        }
      })
    )
    
    return stats
  } catch (error) {
    console.error('Error fetching price stats:', error instanceof Error ? error.message : 'Unknown error')
    // Return empty stats rather than throwing
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
    
    // Begin transaction
    // First, update existing prices to historical
    const productIds = prices.map(p => p.productId)
    
    const { error: updateError } = await supabase
      .from('prices')
      .update({ 
        status: 'historical'
      })
      .eq('retailer', retailer)
      .in('product_id', productIds)
      .eq('status', 'active')
    
    if (updateError) throw updateError
    
    // Insert new prices
    const priceRecords = prices.map(p => ({
      product_id: p.productId,
      retailer,
      price: p.price,
      status: 'active',
      is_promotion: p.isPromotion || false,
      promotion_notes: p.promotionNotes || null,
      timestamp: new Date().toISOString()
    }))
    
    const { error: insertError } = await supabase
      .from('prices')
      .insert(priceRecords)
    
    if (insertError) throw insertError
    
    // Record the price check log
    const { error: logError } = await supabase
      .from('price_check_logs')
      .insert({
        retailer,
        completed: true,
        check_date: new Date().toISOString(),
        notes: `Automated price check - ${prices.length} products updated`
      })
    
    if (logError) throw logError
    
    // Revalidate the prices pages
    revalidatePath('/dashboard/prices')
    revalidatePath('/dashboard/prices/history')
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Error recording price check:', error)
    throw error
  }
}
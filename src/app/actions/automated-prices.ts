'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { firecrawlService } from "@/lib/scraping/firecrawl-service"
import { recordPriceCheck } from "./prices"
import { revalidatePath } from "next/cache"

export interface AutomatedScrapeResult {
  productId: string
  productName: string
  retailer: string
  url: string
  success: boolean
  price?: number
  isPromotion?: boolean
  promotionNotes?: string
  isSoldOut?: boolean
  isAvailable?: boolean
  error?: string
}

export async function scrapeRetailerPrices(retailer: string) {
  try {
    const supabase = await createSupabaseServerClient()

    // Get all products with URLs for this retailer
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        product_urls!inner (
          url,
          retailer
        )
      `)
      .eq('product_urls.retailer', retailer)
    
    if (error) throw error
    
    if (!products || products.length === 0) {
      return {
        success: false,
        message: `No products found with URLs for ${retailer}`,
        results: []
      }
    }
    
    // Prepare URLs for scraping
    const urlsToScrape = products.map(product => ({
      productId: product.id,
      url: product.product_urls[0].url,
      retailer
    }))
    
    // Activity logging removed - no longer tracking attribution
    
    // Scrape all products
    const scrapeResults = await firecrawlService.scrapeMultipleProducts(urlsToScrape)
    
    // Process results
    const results: AutomatedScrapeResult[] = []
    const pricesToRecord = []
    
    for (const product of products) {
      const scrapeResult = scrapeResults.get(product.id)
      
      if (scrapeResult?.success && scrapeResult.data) {
        const { price, isPromotion, promotionNotes, isSoldOut, isAvailable } = scrapeResult.data
        
        // Only record if we have a valid price and product is available
        if (price && isAvailable && !isSoldOut) {
          pricesToRecord.push({
            productId: product.id,
            price,
            isPromotion,
            promotionNotes
          })
        }
        
        results.push({
          productId: product.id,
          productName: product.name,
          retailer,
          url: product.product_urls[0].url,
          success: true,
          price: price || undefined,
          isPromotion,
          promotionNotes,
          isSoldOut,
          isAvailable
        })
      } else {
        results.push({
          productId: product.id,
          productName: product.name,
          retailer,
          url: product.product_urls[0].url,
          success: false,
          error: scrapeResult?.error || 'Unknown error'
        })
      }
    }
    
    // Record successful prices
    if (pricesToRecord.length > 0) {
      await recordPriceCheck(retailer, pricesToRecord)
    }
    
    // Activity logging removed - no longer tracking attribution
    
    // Revalidate pages
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/prices')
    revalidatePath('/dashboard/prices/automation')
    
    return {
      success: true,
      message: `Scraped ${results.filter(r => r.success).length} of ${products.length} products`,
      results
    }
    
  } catch (error) {
    console.error('Automated scraping error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to scrape prices',
      results: []
    }
  }
}

export async function testSingleProductScrape(productId: string, retailer: string) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Get product with URL
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        product_urls!inner (
          url,
          retailer
        )
      `)
      .eq('id', productId)
      .eq('product_urls.retailer', retailer)
      .single()
    
    if (error || !product) {
      return {
        success: false,
        error: 'Product not found or no URL for this retailer'
      }
    }
    
    // Scrape the product using the appropriate retailer-specific method
    const urls = [{
      productId: productId,
      url: product.product_urls[0].url,
      retailer: retailer
    }]
    
    const results = await firecrawlService.scrapeMultipleProducts(urls)
    const result = results.get(productId) || { success: false, error: 'Scraping failed' }
    
    return {
      success: result.success,
      productName: product.name,
      url: product.product_urls[0].url,
      data: result.data,
      error: result.error
    }
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Test scrape failed'
    }
  }
}

export async function getScrapingStatus() {
  try {
    const supabase = await createSupabaseServerClient()

    // Get count of products with URLs
    const { count: urlCount } = await supabase
      .from('product_urls')
      .select('*', { count: 'exact', head: true })

    // Get retailers with URLs
    const { data: retailers } = await supabase
      .from('product_urls')
      .select('retailer')
      .order('retailer')

    const uniqueRetailers = [...new Set(retailers?.map(r => r.retailer) || [])]

    return {
      success: true,
      data: {
        totalProductUrls: urlCount || 0,
        retailersConfigured: uniqueRetailers,
        recentActivity: [], // Activity logging removed
        firecrawlConfigured: !!process.env.FIRECRAWL_API_KEY
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    }
  }
}
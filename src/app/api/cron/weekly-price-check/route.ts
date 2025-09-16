import { NextResponse } from 'next/server'
import { scrapeRetailerPrices } from '@/app/actions/automated-prices'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Manual price check endpoint - triggered from the UI only
export async function POST(request: Request) {
  try {
    // For manual triggers, check if user is authenticated
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      )
    }
    
    // Check if user is whitelisted
    const allowedEmails = [
      'info@kullenjahnke.com',
      'kdjahnke@arkkfood.com',
      'rjahnke@arkkfood.com'
    ]
    
    if (!allowedEmails.includes(user.email || '')) {
      return NextResponse.json(
        { error: 'Unauthorized - user not allowed' },
        { status: 403 }
      )
    }
    
    // Run the same logic as GET but without cron token check
    console.log(`Manual weekly price check triggered by ${user.email}`)
    
    const workingRetailers = ['Hyvee', 'ShopRite']
    const results = []
    
    for (const retailer of workingRetailers) {
      console.log(`Scraping ${retailer}...`)
      
      try {
        const result = await scrapeRetailerPrices(retailer)
        results.push({
          retailer,
          success: result.success,
          message: result.message,
          productsScraped: result.results?.filter(r => r.success).length || 0,
          totalProducts: result.results?.length || 0
        })
      } catch (error) {
        console.error(`Error scraping ${retailer}:`, error)
        results.push({
          retailer,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          productsScraped: 0,
          totalProducts: 0
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Manual price check completed',
      triggeredBy: user.email,
      results
    })
    
  } catch (error) {
    console.error('Manual price check error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
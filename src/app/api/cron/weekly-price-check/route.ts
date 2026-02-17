import { NextResponse } from 'next/server'
import { scrapeRetailerPrices } from '@/app/actions/automated-prices'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isEmailAuthorized } from '@/lib/auth/whitelist'

// Manual price check endpoint - triggered from the UI only
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
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
    if (!isEmailAuthorized(user.email || '')) {
      return NextResponse.json(
        { error: 'Unauthorized - user not allowed' },
        { status: 403 }
      )
    }
    
    // Run the same logic as GET but without cron token check
    const workingRetailers = ['Hyvee', 'ShopRite']
    const results = []
    
    for (const retailer of workingRetailers) {
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
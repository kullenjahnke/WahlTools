import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PriceSummary } from "@/components/dashboard/price-summary"
import { PriceCheckStatus } from "@/components/dashboard/price-check-status"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { 
  ArrowUpRight,
  PackageIcon, 
  ReceiptIcon, 
  CalendarIcon,
  ShoppingBagIcon
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  try {
    const supabase = await createSupabaseServerClient()
    
    const [
      { count: productsCount },
      { data: recentPrices },
      { data: pendingChecks },
      { data: activeRetailers }
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true }),

      supabase
        .from('prices')
        .select('retailer, timestamp')
        .order('timestamp', { ascending: false })
        .limit(1),

      supabase
        .from('price_check_logs')
        .select('id')
        .eq('completed', false)
        .limit(1),

      supabase
        .from('prices')
        .select('retailer')
        .eq('status', 'active')
    ])

    const uniqueRetailers = new Set(activeRetailers?.map(r => r.retailer) || [])

    return (
      <div className="p-6 space-y-6">
        {/* Updated header section with description */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your product pricing across retailers</p>
        </div>
        
        {/* Updated cards grid with modern styling */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Products Card with new styling */}
          <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products Tracked</CardTitle>
              <PackageIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{productsCount || 0}</div>
              <p className="text-xs text-muted-foreground">Total products in database</p>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  asChild
                >
                  <Link href="/dashboard/products">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    View All
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Retailers Card with new styling */}
          <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-teal-500"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Retailers Tracked</CardTitle>
              <ShoppingBagIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueRetailers.size}</div>
              <p className="text-xs text-muted-foreground">Retailers with price data</p>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  asChild
                >
                  <Link href="/dashboard/prices">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    View Prices
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Latest Price Update Card with new styling */}
          <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Latest Price Update</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recentPrices?.[0] 
                  ? new Date(recentPrices[0].timestamp).toLocaleDateString()
                  : 'No updates yet'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {recentPrices?.[0]?.retailer || 'Last recorded price change'}
              </p>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  asChild
                >
                  <Link href="/dashboard/prices/history">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    Price History
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Pending Checks Card with new styling */}
          <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-500 to-orange-500"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Price Checks</CardTitle>
              <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingChecks?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Scheduled checks to complete</p>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  asChild
                >
                  <Link href="/dashboard/prices/check">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    Record Prices
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Updated grid layout for summary components */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-1">
            <PriceSummary />
          </div>
          <div className="md:col-span-1">
            <RecentActivity />
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-1">
          <PriceCheckStatus />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Dashboard error:', error)
    return (
      <div className="p-6">
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor your product pricing across retailers</p>
        </div>
        <div className="mt-6 p-4 border rounded-lg bg-red-50 text-red-500 shadow-md">
          <p className="font-medium">Error loading dashboard data</p>
          <p className="mt-1 text-sm">Please try refreshing the page</p>
        </div>
      </div>
    )
  }
}
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

export const metadata = { title: "Dashboard" }

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

    const stats = [
      {
        label: "Products Tracked",
        value: productsCount || 0,
        sub: "Total products in database",
        icon: PackageIcon,
        href: "/dashboard/products",
        cta: "View All",
      },
      {
        label: "Retailers Tracked",
        value: uniqueRetailers.size,
        sub: "Retailers with price data",
        icon: ShoppingBagIcon,
        href: "/dashboard/prices",
        cta: "View Prices",
      },
      {
        label: "Latest Price Update",
        value: recentPrices?.[0]
          ? new Date(recentPrices[0].timestamp).toLocaleDateString()
          : "No updates yet",
        sub: recentPrices?.[0]?.retailer || "Last recorded price change",
        icon: CalendarIcon,
        href: "/dashboard/prices/history",
        cta: "Price History",
      },
      {
        label: "Pending Price Checks",
        value: pendingChecks?.length || 0,
        sub: "Scheduled checks to complete",
        icon: ReceiptIcon,
        href: "/dashboard/prices/check",
        cta: "Record Prices",
      },
    ]

    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor your product pricing across retailers</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" asChild>
                      <Link href={stat.href}>
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        {stat.cta}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
      <div className="p-4 md:p-6">
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor your product pricing across retailers</p>
        </div>
        <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Error loading dashboard data</p>
          <p className="mt-1 text-sm">Please try refreshing the page</p>
        </div>
      </div>
    )
  }
}
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { PriceCheckStatus } from "@/components/dashboard/price-check-status"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import {
  ArrowUpRight,
  PackageIcon,
  CalendarIcon,
  ShoppingBagIcon,
  CalendarCheck,
} from "lucide-react"

export const metadata = { title: "WahlTools | Dashboard" }

/** Monday 00:00 of the current week in America/New_York, as an ISO string. */
function getCurrentWeekStartISO(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[get('weekday')] ?? 0
  const monday = new Date(Date.UTC(parseInt(get('year')), parseInt(get('month')) - 1, parseInt(get('day')) - dayOffset, 5, 0, 0))
  return monday.toISOString()
}

export default async function DashboardPage() {
  try {
    const supabase = await createSupabaseServerClient()
    const weekStart = getCurrentWeekStartISO()

    const [
      { count: productsCount },
      { data: recentPrices },
      { data: activeRetailers },
      { data: weeklyPrices },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('prices').select('retailer, timestamp').order('timestamp', { ascending: false }).limit(1),
      supabase.from('prices').select('retailer').eq('status', 'active'),
      supabase.from('prices').select('product_id').gte('timestamp', weekStart),
    ])

    const uniqueRetailers = new Set(activeRetailers?.map(r => r.retailer) || [])
    const totalProducts = productsCount || 0
    const updatedThisWeek = new Set((weeklyPrices || []).map(p => p.product_id)).size
    const freshPercent = totalProducts > 0 ? Math.round((updatedThisWeek / totalProducts) * 100) : 0
    const freshColor = freshPercent >= 80 ? 'text-brand' : freshPercent >= 50 ? 'text-foreground' : 'text-destructive'
    const freshBar = freshPercent >= 80 ? 'bg-brand' : freshPercent >= 50 ? 'bg-muted-foreground' : 'bg-destructive'

    const stats = [
      {
        label: "Products Tracked",
        value: totalProducts,
        sub: "Total products in catalog",
        icon: PackageIcon,
        href: "/dashboard/products",
        cta: "View products",
      },
      {
        label: "Retailers Tracked",
        value: uniqueRetailers.size,
        sub: "Retailers with price data",
        icon: ShoppingBagIcon,
        href: "/dashboard/prices",
        cta: "View prices",
      },
      {
        label: "Latest Price Update",
        value: recentPrices?.[0]
          ? new Date(recentPrices[0].timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
          : "No updates yet",
        sub: recentPrices?.[0]?.retailer || "Last recorded price change",
        icon: CalendarIcon,
        href: "/dashboard/prices/history",
        cta: "Price history",
      },
    ]

    return (
      <PageContainer>
        <PageHeader title="Dashboard" />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" />
                    {stat.label}
                  </CardTitle>
                  <IconButton
                    label={stat.cta}
                    href={stat.href}
                    icon={<ArrowUpRight className="size-4" />}
                    variant="ghost"
                    className="size-7 -mr-1 text-muted-foreground"
                  />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                </CardContent>
              </Card>
            )
          })}

          {/* Weekly Freshness KPI (promoted from the old Price Summary) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarCheck className="size-4" />
                Weekly Freshness
              </CardTitle>
              <IconButton
                label="Record prices"
                href="/dashboard/prices/check"
                icon={<ArrowUpRight className="size-4" />}
                variant="ghost"
                className="size-7 -mr-1 text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-semibold tabular-nums ${freshColor}`}>{freshPercent}%</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {updatedThisWeek}/{totalProducts} this week
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${freshBar}`}
                  style={{ width: `${freshPercent}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <RecentActivity />
          <PriceCheckStatus />
        </div>
      </PageContainer>
    )
  } catch (error) {
    console.error('Dashboard error:', error)
    return (
      <PageContainer>
        <PageHeader title="Dashboard" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Error loading dashboard data</p>
          <p className="mt-1 text-sm">Please try refreshing the page</p>
        </div>
      </PageContainer>
    )
  }
}

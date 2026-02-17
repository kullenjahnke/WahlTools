"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowUpRight, DollarSign, CalendarCheck } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"

/**
 * Get the Monday 00:00:00 of the current week in America/New_York,
 * returned as an ISO string (UTC).
 */
function getCurrentWeekStartISO(): string {
  const now = new Date()
  // Get date parts in EST/EDT
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''

  const weekday = get('weekday')
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[weekday] ?? 0

  const estYear = parseInt(get('year'))
  const estMonth = parseInt(get('month')) - 1
  const estDay = parseInt(get('day')) - dayOffset

  // Monday 00:00:00 in EST = UTC-5 (or EDT UTC-4)
  // Use 5 AM UTC as conservative EST offset; the query is >= so slight offset is fine
  const monday = new Date(Date.UTC(estYear, estMonth, estDay, 5, 0, 0))
  return monday.toISOString()
}

export function PriceSummary() {
  const [priceStats, setPriceStats] = useState({
    totalProducts: 0,
    latestUpdate: null as string | null
  })
  const [freshness, setFreshness] = useState({
    updatedThisWeek: 0,
    totalProducts: 0
  })
  const [, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientClient()

  const fetchPriceStats = useCallback(async () => {
    try {
      setIsLoading(true)

      const weekStart = getCurrentWeekStartISO()

      // Fetch total products, latest update, and weekly freshness in parallel
      const [productResult, latestResult, weeklyResult, totalResult] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('prices')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1),
        // Get distinct product_ids that have at least one price this week
        supabase
          .from('prices')
          .select('product_id')
          .gte('timestamp', weekStart),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
      ])

      if (productResult.error) throw productResult.error
      if (latestResult.error) throw latestResult.error
      if (totalResult.error) throw totalResult.error

      // Count distinct products updated this week
      const uniqueProductIds = new Set(
        (weeklyResult.data || []).map(p => p.product_id)
      )

      const total = totalResult.count || 0

      setPriceStats({
        totalProducts: productResult.count || 0,
        latestUpdate: latestResult.data?.[0]?.timestamp || null
      })
      setFreshness({
        updatedThisWeek: uniqueProductIds.size,
        totalProducts: total
      })
    } catch (error) {
      console.error('Error fetching price stats:', error instanceof Error ? error.message : 'Unknown error')
      setPriceStats({ totalProducts: 0, latestUpdate: null })
      setFreshness({ updatedThisWeek: 0, totalProducts: 0 })
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPriceStats()

    const channel = supabase
      .channel('prices-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'prices'
      }, () => {
        fetchPriceStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchPriceStats])

  const { totalProducts, latestUpdate } = priceStats
  const { updatedThisWeek, totalProducts: freshTotal } = freshness
  const freshPercent = freshTotal > 0 ? Math.round((updatedThisWeek / freshTotal) * 100) : 0

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Price Overview</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground">Products tracked</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Last updated:</span>
              <span>
                {latestUpdate
                  ? new Date(latestUpdate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'No data'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => router.push('/dashboard/prices')}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              View All
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Weekly Freshness</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {updatedThisWeek} / {freshTotal}{' '}
            <span className={`text-lg font-semibold ${
              freshPercent >= 80 ? 'text-green-600' :
              freshPercent >= 50 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              ({freshPercent}%)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Up-to-date this week</p>
          <div className="mt-3">
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  freshPercent >= 80 ? 'bg-green-500' :
                  freshPercent >= 50 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${freshPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => router.push('/dashboard/prices/check')}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Record Prices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

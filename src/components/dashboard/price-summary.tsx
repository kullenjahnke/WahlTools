"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowUpRight, DollarSign, TrendingUp } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"

export function PriceSummary() {
  const [priceStats, setPriceStats] = useState({
    totalProducts: 0,
    totalPrices: 0,
    latestUpdate: null as string | null
  })
  const [, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientClient()

  const fetchPriceStats = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Fetch count of products
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
      
      if (productError) throw productError
      
      // Fetch count of active prices
      const { count: priceCount, error: priceError } = await supabase
        .from('prices')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
      
      if (priceError) throw priceError
      
      // Get latest price update timestamp
      const { data: latestPrice, error: latestError } = await supabase
        .from('prices')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1)
      
      if (latestError) throw latestError
      
      setPriceStats({
        totalProducts: productCount || 0,
        totalPrices: priceCount || 0,
        latestUpdate: latestPrice?.[0]?.timestamp || null
      })
    } catch (error) {
      console.error('Error fetching price stats:', error instanceof Error ? error.message : 'Unknown error')
      // Set defaults
      setPriceStats({
        totalProducts: 0,
        totalPrices: 0,
        latestUpdate: null
      })
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPriceStats()
    
    // Subscribe to price updates
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

  const { totalProducts, totalPrices, latestUpdate } = priceStats

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
          <CardTitle className="text-sm font-medium">Active Prices</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPrices}</div>
          <p className="text-xs text-muted-foreground">Current price entries</p>
          <div className="mt-4 flex justify-end">
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
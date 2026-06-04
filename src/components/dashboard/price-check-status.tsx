"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, CalendarClock, CheckCircle2, Clock } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"
import { RETAILERS } from "@/lib/config/retailers"
import { useRouter } from "next/navigation"

interface RetailerStatus {
  retailer: string
  lastCheck: string | null
  status: 'ok' | 'warning' | 'overdue'
  daysAgo: number | null
}

export function PriceCheckStatus() {
  const [retailerStatuses, setRetailerStatuses] = useState<RetailerStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClientClient()

  const fetchPriceCheckStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const statuses = await Promise.all(
        RETAILERS.map(async (retailer) => {
          const { data, error } = await supabase
            .from('price_check_logs')
            .select('*')
            .eq('retailer', retailer)
            .eq('completed', true)
            .order('completed_at', { ascending: false })
            .limit(1)
          
          if (error) throw error
          
          const lastCheck = data?.[0]?.completed_at || null
          
          let daysAgo = null
          if (lastCheck) {
            const lastCheckDate = new Date(lastCheck)
            const today = new Date()
            const diffTime = today.getTime() - lastCheckDate.getTime()
            daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          }
          
          let status: 'ok' | 'warning' | 'overdue' = 'ok'
          
          if (!lastCheck) {
            status = 'overdue'
          } else if (daysAgo !== null) {
            if (daysAgo > 14) {
              status = 'overdue'
            } else if (daysAgo > 7) {
              status = 'warning'
            }
          }
          
          return {
            retailer,
            lastCheck,
            status,
            daysAgo
          }
        })
      )
      
      setRetailerStatuses(statuses)
    } catch (error) {
      console.error('Error fetching price check status:', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchPriceCheckStatus()
    
    // Subscribe to price check log updates
    const channel = supabase
      .channel('price-check-logs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'price_check_logs'
      }, () => {
        fetchPriceCheckStatus()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPriceCheckStatus, supabase])

  const sortedStatuses = [...retailerStatuses].sort((a, b) => {
    const statusPriority = { overdue: 0, warning: 1, ok: 2 }
    
    if (statusPriority[a.status] !== statusPriority[b.status]) {
      return statusPriority[a.status] - statusPriority[b.status]
    }
    
    if (!a.daysAgo) return -1
    if (!b.daysAgo) return 1
    
    return b.daysAgo - a.daysAgo
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Price Check Status</CardTitle>
        </CardHeader>
        <CardContent>
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Price Check Status</CardTitle>
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedStatuses.slice(0, 5).map((status) => (
            <div key={status.retailer} className="flex items-center justify-between">
              <div className="flex items-center">
                {status.status === 'ok' && (
                  <CheckCircle2 className="h-4 w-4 text-brand mr-2" />
                )}
                {status.status === 'warning' && (
                  <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                )}
                {status.status === 'overdue' && (
                  <Clock className="h-4 w-4 text-destructive mr-2" />
                )}
                <span className="text-sm">{status.retailer}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {status.lastCheck ? (
                  <span>
                    {status.daysAgo === 0 ? 'Today' : 
                     status.daysAgo === 1 ? 'Yesterday' : 
                     `${status.daysAgo} days ago`}
                  </span>
                ) : (
                  <span>Never checked</span>
                )}
              </div>
            </div>
          ))}
          
          {sortedStatuses.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <p>No price check data available</p>
            </div>
          )}
          
          <div className="mt-2 pt-2 border-t flex justify-between">
            <span className="text-xs text-muted-foreground">
              {sortedStatuses.filter(s => s.status === 'overdue').length} overdue
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => router.push('/dashboard/prices/check')}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Check Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
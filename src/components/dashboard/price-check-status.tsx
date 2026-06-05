"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { IconButton } from "@/components/ui/icon-button"
import { ClipboardCheck } from "lucide-react"
import { createClientClient } from "@/lib/supabase/client"
import { RETAILERS } from "@/lib/config/retailers"
import { RETAILER_ICONS } from "@/components/icons/retailers"
import { cn } from "@/lib/utils"

type CheckState = "ok" | "warning" | "overdue"

interface RetailerStatus {
  retailer: string
  lastCheck: string | null
  status: CheckState
  daysAgo: number | null
}

const STATUS_META: Record<CheckState, { label: string; chip: string; dot: string }> = {
  ok: { label: "Current", chip: "bg-brand-muted text-brand", dot: "bg-brand" },
  warning: {
    label: "Due soon",
    chip: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  overdue: {
    label: "Overdue",
    chip: "bg-destructive/12 text-destructive",
    dot: "bg-destructive",
  },
}

function relativeLabel(status: RetailerStatus) {
  if (!status.lastCheck || status.daysAgo === null) return "Never"
  if (status.daysAgo === 0) return "Today"
  if (status.daysAgo === 1) return "Yesterday"
  return `${status.daysAgo}d ago`
}

export function PriceCheckStatus() {
  const [retailerStatuses, setRetailerStatuses] = useState<RetailerStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

          let status: CheckState = 'ok'
          if (!lastCheck) {
            status = 'overdue'
          } else if (daysAgo !== null) {
            if (daysAgo > 14) status = 'overdue'
            else if (daysAgo > 7) status = 'warning'
          }

          return { retailer, lastCheck, status, daysAgo }
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
    return (b.daysAgo ?? Infinity) - (a.daysAgo ?? Infinity)
  })

  const counts = {
    overdue: retailerStatuses.filter((s) => s.status === 'overdue').length,
    warning: retailerStatuses.filter((s) => s.status === 'warning').length,
    ok: retailerStatuses.filter((s) => s.status === 'ok').length,
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-medium">Price Check Status</CardTitle>
        <IconButton
          label="Record prices"
          href="/dashboard/prices/check"
          icon={<ClipboardCheck className="size-4" />}
          variant="outline"
          className="size-8"
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Summary counts */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(["overdue", "warning", "ok"] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", STATUS_META[key].dot)} />
              {counts[key]} {STATUS_META[key].label.toLowerCase()}
            </span>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sortedStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No price check data available</p>
        ) : (
          <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {sortedStatuses.map((status) => {
              const Icon = RETAILER_ICONS[status.retailer]
              const meta = STATUS_META[status.status]
              return (
                <div key={status.retailer} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {Icon ? (
                      <Icon className="h-4 w-auto max-w-6 shrink-0" />
                    ) : (
                      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} />
                    )}
                    <span className="truncate text-sm">{status.retailer}</span>
                  </div>
                  <Chip label={relativeLabel(status)} tone={meta.chip} size="sm" />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

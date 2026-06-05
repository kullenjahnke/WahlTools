"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronUp, Package, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface Update {
  id: string
  type: "product" | "price"
  name: string
  retailer?: string
  price?: number
  timestamp: string
}

// Collapsed height keeps the card aligned with its neighbour; the fade + "See
// all" reveal the rest in place.
const COLLAPSED_THRESHOLD = 5

export function RecentUpdatesList({ updates }: { updates: Update[] }) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = updates.length > COLLAPSED_THRESHOLD

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex-1">
        <div
          className={cn(
            "space-y-3",
            !expanded && canExpand && "max-h-[300px] overflow-hidden"
          )}
        >
          {updates.map((update) => {
            const timeAgo = update.timestamp
              ? formatDistanceToNow(new Date(update.timestamp), { addSuffix: true })
              : "Recently"

            return (
              <div key={`${update.type}-${update.id}`} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  {update.type === "product" ? (
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="text-foreground">
                    {update.type === "product" ? (
                      <>Product &quot;{update.name}&quot; updated</>
                    ) : (
                      <>
                        Price updated for &quot;{update.name}&quot;
                        {update.retailer && ` at ${update.retailer}`}
                        {update.price ? ` ($${update.price.toFixed(2)})` : ""}
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{timeAgo}</div>
                </div>
              </div>
            )
          })}
        </div>

        {!expanded && canExpand && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {canExpand && (
        <div className="mt-2 flex justify-center border-t border-border/60 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="ml-1 size-3.5" />
              </>
            ) : (
              <>
                See all <ChevronDown className="ml-1 size-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

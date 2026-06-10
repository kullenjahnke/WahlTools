"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RETAILERS } from "@/lib/config/retailers"
import { recordHistoricalPrice, type HistoricalAvailability } from "@/app/actions/prices"
import { recentCompletedWeekStarts, formatWeekLabel, isInWeek } from "@/lib/weeks"
import type { Price } from "@/types/database"
import { cn } from "@/lib/utils"

const WEEK_COUNT = 16

interface PastPriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productName: string
  prices: Price[]
  onSaved: () => void
}

type ExistingValue =
  | { kind: "price"; price: number }
  | { kind: "sold_out" }
  | { kind: "na" }
  | { kind: "none" }

function classifyExisting(prices: Price[], retailer: string, weekStart: Date): ExistingValue {
  const inWeek = prices
    .filter((p) => p.retailer === retailer && isInWeek(weekStart, p.timestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const latest = inWeek[0]
  if (!latest) return { kind: "none" }
  if (latest.status === "out_of_stock" || latest.is_sold_out) return { kind: "sold_out" }
  if (latest.price <= 0) return { kind: "na" }
  return { kind: "price", price: latest.price }
}

function existingLabel(v: ExistingValue): string {
  switch (v.kind) {
    case "price":
      return `$${v.price.toFixed(2)}`
    case "sold_out":
      return "Sold out"
    case "na":
      return "N/A"
    case "none":
      return "—"
  }
}

const AVAIL_OPTIONS: { value: HistoricalAvailability; label: string }[] = [
  { value: "available", label: "Price" },
  { value: "sold_out", label: "Sold out" },
  { value: "na", label: "N/A" },
]

export function PastPriceDialog({
  open,
  onOpenChange,
  productId,
  productName,
  prices,
  onSaved,
}: PastPriceDialogProps) {
  const weeks = useMemo(() => recentCompletedWeekStarts(WEEK_COUNT), [])
  const [retailer, setRetailer] = useState("")
  const [weekIso, setWeekIso] = useState("")
  const [availability, setAvailability] = useState<HistoricalAvailability>("available")
  const [priceText, setPriceText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.toISOString() === weekIso) ?? null,
    [weeks, weekIso]
  )

  const existing = useMemo<ExistingValue | null>(
    () => (retailer && selectedWeek ? classifyExisting(prices, retailer, selectedWeek) : null),
    [prices, retailer, selectedWeek]
  )

  // Prefill the value fields from the existing entry for a given retailer+week.
  function prefillFor(nextRetailer: string, nextWeekIso: string) {
    const week = weeks.find((w) => w.toISOString() === nextWeekIso) ?? null
    const v = nextRetailer && week ? classifyExisting(prices, nextRetailer, week) : { kind: "none" as const }
    if (v.kind === "price") {
      setAvailability("available")
      setPriceText(v.price.toFixed(2))
    } else if (v.kind === "sold_out") {
      setAvailability("sold_out")
      setPriceText("")
    } else if (v.kind === "na") {
      setAvailability("na")
      setPriceText("")
    } else {
      setAvailability("available")
      setPriceText("")
    }
  }

  // Reset when the dialog opens.
  useEffect(() => {
    if (open) {
      setRetailer("")
      setWeekIso("")
      setAvailability("available")
      setPriceText("")
      setError(null)
    }
  }, [open])

  const canSave =
    !!retailer &&
    !!selectedWeek &&
    !saving &&
    (availability !== "available" || parseFloat(priceText) > 0)

  async function handleSave() {
    if (!retailer || !selectedWeek) return
    setSaving(true)
    setError(null)
    try {
      await recordHistoricalPrice({
        productId,
        retailer,
        weekStart: selectedWeek.toISOString(),
        availability,
        price: availability === "available" ? parseFloat(priceText) : 0,
      })
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add / adjust past price</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Retailer */}
          <div className="space-y-1.5">
            <Label>Retailer</Label>
            <Select value={retailer} onValueChange={(r) => { setRetailer(r); prefillFor(r, weekIso) }} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Select a retailer" />
              </SelectTrigger>
              <SelectContent>
                {RETAILERS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week */}
          <div className="space-y-1.5">
            <Label>Week</Label>
            <Select value={weekIso} onValueChange={(iso) => { setWeekIso(iso); prefillFor(retailer, iso) }} disabled={!retailer || saving}>
              <SelectTrigger>
                <SelectValue placeholder={retailer ? "Select a week" : "Pick a retailer first"} />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => {
                  const v = classifyExisting(prices, retailer, w)
                  return (
                    <SelectItem key={w.toISOString()} value={w.toISOString()}>
                      {formatWeekLabel(w)} · {existingLabel(v)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {existing && existing.kind !== "none" && (
              <p className="text-xs text-muted-foreground">
                Current value for this week: {existingLabel(existing)} — saving will replace it.
              </p>
            )}
          </div>

          {/* Availability + price */}
          <div className="space-y-1.5">
            <Label>Value</Label>
            <div className="inline-flex rounded-md border border-input p-0.5">
              {AVAIL_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAvailability(o.value)}
                  disabled={saving}
                  className={cn(
                    "rounded px-3 py-1 text-sm transition-colors",
                    availability === o.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {availability === "available" && (
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="past-price-input"
                  aria-label="Price in dollars"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  disabled={saving}
                  className="pl-7"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

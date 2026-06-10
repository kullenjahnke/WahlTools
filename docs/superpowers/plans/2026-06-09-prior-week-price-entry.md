# Prior-Week Price Entry/Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized user add or adjust a product's price (or Sold-out / N/A) at any retailer for a **past week**, via a dialog launched from the Price History page, with a clean "one value per product+retailer+week" model that feeds correctly into week-over-week stats.

**Architecture:** A new atomic Postgres RPC `upsert_historical_price` replaces the target week's row(s) for a product+retailer and re-asserts the "latest row is active" invariant without disturbing the current price when backfilling older weeks. A server action wraps the RPC with validation (configured retailer, past-week-only, sane price). A `PastPriceDialog` (launched from `product-history-view.tsx`) lets the user pick retailer + week (with the existing value shown inline) + value, and calls the action. Week math mirrors the existing EST Monday-anchored logic.

**Tech Stack:** Next.js 15 server actions, Supabase RPC (plpgsql), React 19 client dialog (shadcn Dialog/Select/Input), date math via `Intl` (America/New_York).

**Verification note:** This repo has **no test runner**. Each task is verified with `pnpm lint` + `pnpm build`. The RPC + action + dialog cannot be exercised locally (placeholder Supabase creds → no DB/auth/data), so end-to-end smoke must happen in a real environment **after migration `25` is applied in the Supabase SQL Editor**. Tasks are written so each compiles/lints independently.

**Design spec:** `docs/superpowers/specs/2026-06-09-prices-analytics-track-design.md` → "Feature 3".

---

## Data-model context (read before implementing)

- The `prices.status` column is **overloaded**: lifecycle (`active`/`historical`) AND availability (`out_of_stock`). The **current** price for a product+retailer is the **latest-timestamp row**; the Prices table and history compute "current" by timestamp.
- "N/A" (no longer carried) = `price <= 0` and not sold out. "Sold out" = `status='out_of_stock'` or `is_sold_out=true`.
- The existing `record_price_check` RPC **never deletes** rows — it UPDATEs `active`→`historical`. This feature introduces the first deletion path, so the RPC defensively clears any dependent `price_change_logs` rows first (that table's `price_id` FK exists per the DB types, but its `ON DELETE` behavior is not defined in the tracked migrations, and the table may not exist in every environment).
- Week boundaries = **Monday 00:00 America/New_York**, matching `getWeekStartEST` in `src/app/actions/prices.ts`.
- **Refinement vs. spec:** the spec sketched the RPC taking a `p_status` arg and recomputing the active flag. During planning we simplified: the RPC takes **`p_price` + `p_is_sold_out`** and derives the row's status itself (Available → latest-aware `active`/`historical`; Sold out → `out_of_stock`; N/A → `historical`). This avoids the overloaded-status ambiguity and correctly preserves "current price" semantics (including the case where the most-recent row is sold-out). Same outcome, cleaner contract.

---

## File Structure

- **Create** `migrations/25_upsert_historical_price.sql` — the atomic RPC (run manually in Supabase, like all migrations).
- **Create** `src/lib/weeks.ts` — pure, client-safe week helpers (`getWeekStartEST`, `recentCompletedWeekStarts`, `formatWeekLabel`, `isInWeek`).
- **Modify** `src/app/actions/prices.ts` — add `HistoricalAvailability` type + `recordHistoricalPrice` server action.
- **Create** `src/components/prices/past-price-dialog.tsx` — the dialog.
- **Modify** `src/components/prices/product-history-view.tsx` — launch button + dialog mount.

---

## Task 1: The `upsert_historical_price` RPC migration

**Files:**
- Create: `migrations/25_upsert_historical_price.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 25: upsert_historical_price
--
-- Add/adjust a product's price at a retailer for a PAST week. Implements the
-- "one representative value per product+retailer+week" model: it REPLACES any
-- existing rows in the target week, inserts a single row anchored at that week's
-- Monday 12:00 EST, and re-asserts the "latest row is the active one" invariant
-- so backfilling older weeks never disturbs the current price.
--
-- Status is derived from price + is_sold_out:
--   sold out      -> 'out_of_stock'        (price 0, is_sold_out true)
--   N/A           -> 'historical'          (price <= 0, is_sold_out false)
--   available     -> 'active' if this becomes the most-recent row, else 'historical'
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION upsert_historical_price(
  p_product_id  uuid,
  p_retailer    text,
  p_week_start  timestamptz,
  p_price       numeric,
  p_is_sold_out boolean
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_end timestamptz := p_week_start + interval '7 days';
  v_ts         timestamptz := p_week_start + interval '12 hours'; -- Monday noon EST
  v_is_latest  boolean;
  v_new_status text;
BEGIN
  -- Defensively clear dependent change logs for the rows we're about to delete
  -- (legacy/optional table; FK ON DELETE behavior is undefined in tracked migrations).
  IF to_regclass('public.price_change_logs') IS NOT NULL THEN
    DELETE FROM price_change_logs
    WHERE price_id IN (
      SELECT id FROM prices
      WHERE product_id = p_product_id
        AND retailer = p_retailer
        AND timestamp >= p_week_start
        AND timestamp <  v_window_end
    );
  END IF;

  -- Replace: remove existing rows for this product+retailer inside the target week.
  DELETE FROM prices
  WHERE product_id = p_product_id
    AND retailer = p_retailer
    AND timestamp >= p_week_start
    AND timestamp <  v_window_end;

  -- Will the new row be the most-recent for this product+retailer?
  SELECT NOT EXISTS (
    SELECT 1 FROM prices
    WHERE product_id = p_product_id
      AND retailer = p_retailer
      AND timestamp > v_ts
  ) INTO v_is_latest;

  -- Derive the new row's status.
  IF p_is_sold_out THEN
    v_new_status := 'out_of_stock';
  ELSIF p_price <= 0 THEN
    v_new_status := 'historical';      -- N/A
  ELSIF v_is_latest THEN
    v_new_status := 'active';
  ELSE
    v_new_status := 'historical';
  END IF;

  -- If the new row becomes active, demote any prior active row(s).
  IF v_new_status = 'active' THEN
    UPDATE prices
    SET status = 'historical'
    WHERE product_id = p_product_id
      AND retailer = p_retailer
      AND status = 'active';
  END IF;

  -- Insert the single representative row for the week.
  INSERT INTO prices (product_id, retailer, price, status, is_sold_out, timestamp)
  VALUES (p_product_id, p_retailer, p_price, v_new_status, COALESCE(p_is_sold_out, false), v_ts);
END;
$$;
```

- [ ] **Step 2: Verify (static)**

This is SQL run manually in Supabase; it cannot be executed by `pnpm`. Re-read it against the data-model context above: confirm the delete window is `[week_start, week_start+7d)`, the change-log guard uses `to_regclass`, status derivation matches the three cases, and the active-demotion only runs when the new row is active. There is nothing to build here.

- [ ] **Step 3: Commit**

```bash
git add migrations/25_upsert_historical_price.sql
git commit -m "feat(prices): upsert_historical_price RPC for past-week entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Week helpers (`src/lib/weeks.ts`)

Pure, client-safe (no server imports) so the dialog can compute weeks the same way the server validates them.

**Files:**
- Create: `src/lib/weeks.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/weeks.ts
//
// EST (America/New_York) Monday-anchored week helpers, mirroring getWeekStartEST
// in src/app/actions/prices.ts so client week math lines up with server WoW math.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Monday 00:00 in America/New_York for the week containing `date`, returned as
 * the equivalent UTC instant.
 */
export function getWeekStartEST(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ""
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[get("weekday")] ?? 0
  const year = parseInt(get("year"))
  const month = parseInt(get("month")) - 1
  const day = parseInt(get("day")) - dayOffset
  const monday = new Date(Date.UTC(year, month, day, 5, 0, 0)) // assume EST (UTC-5)
  // DST correction: Mar–Oct use EDT (UTC-4)
  const m = monday.getUTCMonth()
  if (m >= 2 && m <= 10) monday.setUTCHours(4)
  return monday
}

/**
 * The last `count` completed weeks (Monday-anchored EST), STRICTLY BEFORE the
 * current week, most recent first. Anchored at Monday noon before subtracting so
 * a DST ±1h drift never crosses a day boundary.
 */
export function recentCompletedWeekStarts(count: number, now: Date = new Date()): Date[] {
  const currentMondayNoon = new Date(getWeekStartEST(now).getTime() + 12 * 60 * 60 * 1000)
  const out: Date[] = []
  for (let i = 1; i <= count; i++) {
    out.push(getWeekStartEST(new Date(currentMondayNoon.getTime() - i * WEEK_MS)))
  }
  return out
}

/** "Week of Jun 2" — the week-start date formatted in EST. */
export function formatWeekLabel(weekStart: Date): string {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(weekStart)
  return `Week of ${label}`
}

/** True if `ts` falls within [weekStart, weekStart + 7 days). */
export function isInWeek(weekStart: Date, ts: string | Date): boolean {
  const t = new Date(ts).getTime()
  return t >= weekStart.getTime() && t < weekStart.getTime() + WEEK_MS
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean (module unused so far; must type-check).

- [ ] **Step 3: Commit**

```bash
git add src/lib/weeks.ts
git commit -m "feat(prices): EST week helpers for past-week entry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `recordHistoricalPrice` server action

**Files:**
- Modify: `src/app/actions/prices.ts`

- [ ] **Step 1: Append the type + action**

Add to the END of `src/app/actions/prices.ts` (the file already has `'use server'` at top and imports `RETAILERS` and `getWeekStartEST` is defined locally in this file — reuse it):

```typescript
export type HistoricalAvailability = "available" | "sold_out" | "na"

/**
 * Add or adjust a product's price at a retailer for a PAST week. Routes through
 * the atomic upsert_historical_price RPC (migration 25), which replaces the
 * target week's value and preserves the current-price invariant.
 */
export async function recordHistoricalPrice(input: {
  productId: string
  retailer: string
  weekStart: string // ISO of Monday 00:00 EST
  availability: HistoricalAvailability
  price: number // dollars; ignored unless availability === "available"
}) {
  try {
    if (!(RETAILERS as readonly string[]).includes(input.retailer)) {
      throw new Error(`Unknown retailer: ${input.retailer}`)
    }

    const weekStart = new Date(input.weekStart)
    if (Number.isNaN(weekStart.getTime())) throw new Error("Invalid week")

    // Past weeks only: strictly before the current week's start.
    const currentWeekStart = getWeekStartEST(new Date())
    if (weekStart.getTime() >= currentWeekStart.getTime()) {
      throw new Error("Only past weeks can be edited here")
    }

    const isSoldOut = input.availability === "sold_out"
    const price = input.availability === "available" ? input.price : 0
    if (input.availability === "available" && !(price > 0 && price < 100000)) {
      throw new Error("Enter a valid price")
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc("upsert_historical_price", {
      p_product_id: input.productId,
      p_retailer: input.retailer,
      p_week_start: weekStart.toISOString(),
      p_price: price,
      p_is_sold_out: isSoldOut,
    })
    if (error) throw error

    revalidatePath("/dashboard/prices")
    revalidatePath("/dashboard/prices/history")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/analytics")
    return { success: true }
  } catch (error) {
    console.error("Error recording historical price:", error)
    throw error
  }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean. Confirm `getWeekStartEST` resolves (it is defined earlier in this same file) and `RETAILERS` is already imported at the top.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/prices.ts
git commit -m "feat(prices): recordHistoricalPrice server action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `PastPriceDialog` component

**Files:**
- Create: `src/components/prices/past-price-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
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

  // Prefill the form from the existing value when retailer/week changes.
  useEffect(() => {
    if (!existing) return
    if (existing.kind === "price") {
      setAvailability("available")
      setPriceText(existing.price.toFixed(2))
    } else if (existing.kind === "sold_out") {
      setAvailability("sold_out")
      setPriceText("")
    } else if (existing.kind === "na") {
      setAvailability("na")
      setPriceText("")
    } else {
      setAvailability("available")
      setPriceText("")
    }
  }, [existing])

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
            <Select value={retailer} onValueChange={setRetailer}>
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
            <Select value={weekIso} onValueChange={setWeekIso} disabled={!retailer}>
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
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
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
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean. (Importing the `HistoricalAvailability` *type* and the `recordHistoricalPrice` action from the `'use server'` file is fine — this matches the existing pattern where `prices.ts` exports types like `PriceStatus`/`PriceEntryInput`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/prices/past-price-dialog.tsx
git commit -m "feat(prices): PastPriceDialog for past-week entry/adjustment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Launch the dialog from Price History

**Files:**
- Modify: `src/components/prices/product-history-view.tsx`

- [ ] **Step 1: Add imports**

In `src/components/prices/product-history-view.tsx`:
- Add `useRouter`: change `import { ChevronDown, PackageSearch } from "lucide-react"` to also import `CalendarPlus`: `import { CalendarPlus, ChevronDown, PackageSearch } from "lucide-react"`.
- Add these imports near the other component imports:
```tsx
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PastPriceDialog } from "@/components/prices/past-price-dialog"
```

- [ ] **Step 2: Add router + dialog state**

Inside `ProductHistoryView`, after the existing `const chart = useChartTheme()` line, add:
```tsx
  const router = useRouter()
  const [pastDialogOpen, setPastDialogOpen] = useState(false)
```

- [ ] **Step 3: Add the launch button to the change-log card header**

Find the change-log heading:
```tsx
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Price changes — {product.name}
            </h4>
```
Replace it with a header row that includes the button:
```tsx
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Price changes — {product.name}
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPastDialogOpen(true)}
                className="h-8"
              >
                <CalendarPlus className="size-4" />
                Add / adjust past price
              </Button>
            </div>
```

- [ ] **Step 4: Mount the dialog**

Immediately before the final closing `</div>` of the component's returned tree (the outer `<div className="space-y-4">`), add:
```tsx
      {product && (
        <PastPriceDialog
          open={pastDialogOpen}
          onOpenChange={setPastDialogOpen}
          productId={product.id}
          productName={product.name}
          prices={product.prices ?? []}
          onSaved={() => router.refresh()}
        />
      )}
```

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean. Confirm one `lucide-react` import line with `CalendarPlus, ChevronDown, PackageSearch`, and that `useState`/`useRouter` resolve.

- [ ] **Step 6: Commit**

```bash
git add src/components/prices/product-history-view.tsx
git commit -m "feat(prices): launch past-price dialog from Price History

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verification + review

No automated tests exist; this is a deliberate review + (where possible) live smoke.

- [ ] **Step 1: Static review against the spec**

Confirm: dialog opens from Price History, scoped to the selected product; retailer = configured 9; week list = last 16 completed weeks (past only) with the existing value shown inline; Save replaces the week's value; Available/Sold-out/N/A all supported; success refreshes the page. Confirm the action rejects current/future weeks and unknown retailers.

- [ ] **Step 2: Final lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 3: Live smoke (in an environment with real Supabase data, AFTER applying migration 25)**

Apply `migrations/25_upsert_historical_price.sql` in the Supabase SQL Editor first. Then: Price History → pick a product → **Add / adjust past price** → pick a retailer + an older week with no data → enter a price → Save. Verify: the chart/change-log gains a point at that week; the **current** price on the Prices table is unchanged; the dashboard/Analytics WoW reflects the corrected history. Re-save the same week with a different value → it **replaces** (no duplicate point). Test Sold-out and N/A. Confirm light + dark.

---

## Self-Review (done at authoring time)

- **Spec coverage:** dialog from Price History (Task 5) ✓; retailer + week picker with inline existing value (Task 4) ✓; Price/Sold-out/N/A (Task 4 + action mapping Task 3) ✓; replace-by-week (RPC Task 1) ✓; past-weeks-only (action Task 3 + week list Task 2) ✓; active invariant / current price untouched (RPC Task 1) ✓; WoW flow-through via revalidate + timestamp bucketing (Task 3) ✓; defensive change-log delete + FK note (Task 1) ✓.
- **Type consistency:** `HistoricalAvailability` defined in Task 3, consumed in Task 4; `recordHistoricalPrice` input shape matches between action (Task 3) and caller (Task 4); `getWeekStartEST`/`recentCompletedWeekStarts`/`formatWeekLabel`/`isInWeek` defined in Task 2 and used in Tasks 3–4; RPC param names (`p_product_id`, `p_retailer`, `p_week_start`, `p_price`, `p_is_sold_out`) match between Task 1 and the action's `.rpc(...)` call in Task 3.
- **Placeholders:** none — every step has full code/commands.
- **Note:** the feature is inert until migration 25 is applied in Supabase (called out in Task 6 Step 3 and to be repeated in the PR body).

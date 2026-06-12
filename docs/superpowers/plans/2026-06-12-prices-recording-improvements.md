# B1 + B2 — Price Recording Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry last week's sale (original price + promo) when reusing last week's price (B1), and auto-advance across retailers in sequential entry with a skip/interstitial flow (B2).

**Architecture:** B1 extends two server-page price queries to also load `original_price`/`is_promotion` and threads them into the existing "reuse last week" affordances. B2 adds retailer chaining state + a between-retailers interstitial to the sequential client component. No DB/migration changes.

**Tech Stack:** Next.js 15 server components (the two host pages) + React client components. No test runner — verification is `pnpm lint` + `pnpm build` plus manual smoke on the deployed build.

---

## Note on verification

No unit-test runner. Each task's gate is `pnpm lint` + `pnpm build` (both clean). Design every touched
surface for **light and dark** mode. Live smoke is on the deployed build (local Supabase creds are
placeholders).

## File Structure
- **Modify** `src/app/(dashboard)/dashboard/prices/sequential/page.tsx` — query + richer last-price map (B1).
- **Modify** `src/components/prices/sequential-price-entry.tsx` — last-week promo carry (B1) + retailer auto-advance (B2).
- **Modify** `src/app/(dashboard)/dashboard/prices/check/page.tsx` — query + last promo fields (B1).
- **Modify** `src/components/prices/price-check-form.tsx` — last-week promo carry (B1).

Order: Task 1 (B1 sequential) → Task 2 (B1 check form) → Task 3 (B2 sequential).

---

## Task 1: B1 — carry last week's sale in sequential entry

**Files:** Modify `src/app/(dashboard)/dashboard/prices/sequential/page.tsx`, `src/components/prices/sequential-price-entry.tsx`.

- [ ] **Step 1: Extend the prices query**

In `sequential/page.tsx`, change the `prices` select (~line 30-33) from:

```ts
        supabase
          .from("prices")
          .select("product_id, retailer, price, timestamp")
          .gte("timestamp", since)
          .order("timestamp", { ascending: false }),
```

to:

```ts
        supabase
          .from("prices")
          .select("product_id, retailer, price, timestamp, original_price, is_promotion")
          .gte("timestamp", since)
          .order("timestamp", { ascending: false }),
```

- [ ] **Step 2: Build the richer last-price map**

In `sequential/page.tsx`, after the `historyByProduct` loop (~line 58, before `const products = ...`), add a
map of the newest positive-price record per (product, retailer) with promo fields:

```ts
    // Newest positive-price record per (product, retailer), incl. promo fields — for last-week carry.
    type LastEntry = { price: number; original_price: number | null; is_promotion: boolean }
    const lastByProduct = new Map<string, Record<string, LastEntry>>()
    for (const row of (pricesResult.data || []) as Array<{
      product_id: string; retailer: string; price: number | null; original_price: number | null; is_promotion: boolean | null
    }>) {
      if (!row.price || row.price <= 0) continue
      const rec = lastByProduct.get(row.product_id) || {}
      if (!(row.retailer in rec)) {
        rec[row.retailer] = { price: row.price, original_price: row.original_price ?? null, is_promotion: row.is_promotion ?? false }
        lastByProduct.set(row.product_id, rec)
      }
    }
```

Then replace the existing per-product `lastPriceByRetailer` loop (~lines 71-77) — delete:

```ts
      // Build per-retailer last price map (keep first = newest per retailer)
      const lastPriceByRetailer: Record<string, number> = {}
      for (const h of history) {
        if (!(h.retailer in lastPriceByRetailer)) {
          lastPriceByRetailer[h.retailer] = h.price
        }
      }
```

and in the returned object change `lastPriceByRetailer,` to:

```ts
        lastPriceByRetailer: lastByProduct.get(product.id) || {},
```

- [ ] **Step 3: Update `SeqProduct` type + `lastWeek` in the component**

In `sequential-price-entry.tsx`, change the `lastPriceByRetailer` field on `SeqProduct` (~line 24):

```ts
  lastPriceByRetailer: Record<string, { price: number; original_price: number | null; is_promotion: boolean }>
```

The `lastWeek` derivation (~line 82) already reads `current.lastPriceByRetailer[retailer!] ?? null`; it now
yields an object or null — no change to that line, but all downstream uses must switch from a number to
`.price` (next steps).

- [ ] **Step 4: Add a shared `reuseLastWeek` helper**

In `sequential-price-entry.tsx`, add this `useCallback` near the other helpers (after `resetCard`,
before `advance`):

```ts
  const reuseLastWeek = useCallback(() => {
    if (!lastWeek) return
    setIsSoldOut(false)
    setIsNotAvailable(false)
    setPrice(lastWeek.price.toFixed(2))
    if (lastWeek.is_promotion && lastWeek.original_price != null) {
      setIsPromo(true)
      setOriginalPrice(lastWeek.original_price.toFixed(2))
    } else {
      setIsPromo(false)
      setOriginalPrice("")
    }
    priceInputRef.current?.focus()
  }, [lastWeek])
```

- [ ] **Step 5: Use the helper in the chip + hotkey, and fix the price display**

In the `L` hotkey branch (~lines 241-245), replace:

```ts
      if (k === "l" && lastWeek != null) {
        e.preventDefault()
        setIsSoldOut(false)
        setIsNotAvailable(false)
        setPrice(lastWeek.toFixed(2))
      } else if (k === "s") {
```

with:

```ts
      if (k === "l" && lastWeek != null) {
        e.preventDefault()
        reuseLastWeek()
      } else if (k === "s") {
```

Add `reuseLastWeek` to that effect's dependency array (the one ending
`[current, lastWeek, save, openBeside, toggleSoldOut, toggleNotAvailable]`) → append `, reuseLastWeek`.

In the "Last week" chip (~lines 434-450), replace the `onClick` body and the displayed amount:

```tsx
            <button
              onClick={reuseLastWeek}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] px-2.5 py-1.5 text-[12px] font-semibold text-brand hover:bg-[hsl(var(--brand)/0.12)] transition-colors"
            >
              <span>↺ Last week</span>
              <span className="tabular-nums">${lastWeek.price.toFixed(2)}</span>
              <kbd className="font-mono text-[10px] bg-white dark:bg-background border border-[hsl(var(--brand)/0.4)] rounded px-[5px] py-px text-brand leading-none">
                L
              </kbd>
            </button>
```

(The `{lastWeek != null && (` guards on the chip and the hint bar are unchanged — `!= null` works on the
object.)

- [ ] **Step 6: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean (no `lastWeek.toFixed`/type errors remaining).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/dashboard/prices/sequential/page.tsx" src/components/prices/sequential-price-entry.tsx
git commit -m "feat(prices): carry last week's sale into sequential entry (B1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: B1 — carry last week's sale in the check form

**Files:** Modify `src/app/(dashboard)/dashboard/prices/check/page.tsx`, `src/components/prices/price-check-form.tsx`.

- [ ] **Step 1: Extend the prices query**

In `check/page.tsx`, change the `prices` select (~line 38-42) to add the two fields:

```ts
      supabase
        .from('prices')
        .select('product_id, retailer, price, timestamp, original_price, is_promotion')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false }),
```

- [ ] **Step 2: Build the last-entry map and thread promo fields**

In `check/page.tsx`, after `effectiveRetailer` is computed and after the `historyByProduct` loop
(~line 90), add:

```ts
    // Newest positive-price record per product at the effective retailer (for last-week carry, incl. promo).
    const lastEntryByProduct = new Map<string, { price: number; original_price: number | null; is_promotion: boolean }>()
    for (const row of (pricesResult.data || []) as Array<{
      product_id: string; retailer: string; price: number | null; original_price: number | null; is_promotion: boolean | null
    }>) {
      if (row.retailer !== effectiveRetailer) continue
      if (!row.price || row.price <= 0) continue
      if (!lastEntryByProduct.has(row.product_id)) {
        lastEntryByProduct.set(row.product_id, { price: row.price, original_price: row.original_price ?? null, is_promotion: row.is_promotion ?? false })
      }
    }
```

In the `formattedProducts.map`, replace the `lastAtRetailer` derivation (~lines 105-108) and the returned
`lastPrice`:

```ts
      // History (outlier context) + last entry at this retailer (for carry-over)
      const history = historyByProduct.get(product.id) || []
      const lastEntry = lastEntryByProduct.get(product.id) ?? null
```

and in the returned object replace `lastPrice: lastAtRetailer,` with:

```ts
        lastPrice: lastEntry?.price ?? null,
        lastOriginalPrice: lastEntry?.original_price ?? null,
        lastWasPromo: lastEntry?.is_promotion ?? false,
```

- [ ] **Step 3: Add the new fields to `SimpleProduct` + a `carryOverLastWeek` helper**

In `price-check-form.tsx`, add to the `SimpleProduct` interface (after `lastPrice: number | null`):

```ts
  lastOriginalPrice: number | null
  lastWasPromo: boolean
```

Add a helper near the other handlers (after `handleNotAvailableToggle`):

```ts
  const carryOverLastWeek = (product: SimpleProduct) => {
    if (product.lastPrice == null) return
    setPrices(prev => ({ ...prev, [product.id]: product.lastPrice!.toFixed(2) }))
    if (product.lastWasPromo && product.lastOriginalPrice != null) {
      setPromos(prev => ({ ...prev, [product.id]: true }))
      setOriginalPrices(prev => ({ ...prev, [product.id]: product.lastOriginalPrice!.toFixed(2) }))
    }
  }
```

- [ ] **Step 4: Use the helper on the "Same as last week" button**

In `price-check-form.tsx`, the carry-over button (~line 453-455) — replace its `onClick`:

```tsx
                          <button
                            type="button"
                            onClick={() => carryOverLastWeek(product)}
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-1.5 py-0.5 hover:text-foreground hover:border-muted-foreground transition-colors w-fit"
                          >
```

(The button label and the `showCarryOver` gate are unchanged.)

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/dashboard/prices/check/page.tsx" src/components/prices/price-check-form.tsx
git commit -m "feat(prices): carry last week's sale into the check form (B1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: B2 — auto-advance across retailers in sequential entry

**File:** Modify `src/components/prices/sequential-price-entry.tsx`.

- [ ] **Step 1: Add imports for the toggle**

Add to the imports at the top:

```ts
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
```

- [ ] **Step 2: Add state**

After the existing `useState` declarations (after `loading`, ~line 68), add:

```ts
  const [autoAdvanceRetailers, setAutoAdvanceRetailers] = useState(true)
  const [completedRetailers, setCompletedRetailers] = useState<Set<string>>(
    () => new Set(Object.keys(checkStatus).filter((r) => !!checkStatus[r]))
  )
  const [interstitial, setInterstitial] = useState<{ finished: string; next: string } | null>(null)
```

- [ ] **Step 3: Add deck-size + next-retailer helpers**

Add near the other `useCallback`s (after `deck` is defined / before `advance`):

```ts
  const deckSizeFor = useCallback(
    (r: string) => products.filter((p) => p.urls.some((u) => u.retailer === r)).length,
    [products]
  )

  // Next forward retailer in canonical order that isn't completed and has products.
  const findNextRetailer = useCallback(
    (after: string, completed: Set<string>): string | null => {
      const start = retailers.indexOf(after)
      for (let i = start + 1; i < retailers.length; i++) {
        const r = retailers[i]
        if (!completed.has(r) && deckSizeFor(r) > 0) return r
      }
      return null
    },
    [retailers, deckSizeFor]
  )
```

- [ ] **Step 4: Rework `advance` to chain retailers**

Replace the existing `advance` callback (~lines 100-112) with:

```ts
  const advance = useCallback(() => {
    resetCard()
    if (index < deck.length - 1) {
      setIndex(index + 1)
      return
    }
    // Deck finished for this retailer.
    const finished = retailer!
    const nextCompleted = new Set(completedRetailers)
    nextCompleted.add(finished)
    setCompletedRetailers(nextCompleted)
    if (autoAdvanceRetailers) {
      const next = findNextRetailer(finished, nextCompleted)
      if (next) {
        setInterstitial({ finished, next })
        return
      }
      // Chained through and nothing left.
      toast({
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "All retailers complete!",
        description: `Saved ${savedCount + 1} price${savedCount + 1 === 1 ? "" : "s"}.`,
      })
    } else {
      // Toggle off: just this one retailer finished (today's behavior).
      toast({
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Retailer complete!",
        description: `Saved ${savedCount + 1} price${savedCount + 1 === 1 ? "" : "s"} for ${finished}.`,
      })
    }
    router.push("/dashboard/prices")
  }, [index, deck.length, resetCard, savedCount, retailer, router, toast, autoAdvanceRetailers, completedRetailers, findNextRetailer])
```

- [ ] **Step 5: Add interstitial action handlers**

Add after `advance` (and after `goBack`):

```ts
  const continueToNext = useCallback(() => {
    if (!interstitial) return
    setRetailer(interstitial.next)
    setIndex(0)
    resetCard()
    setInterstitial(null)
  }, [interstitial, resetCard])

  const skipNextRetailer = useCallback(() => {
    if (!interstitial) return
    const next = findNextRetailer(interstitial.next, completedRetailers)
    if (next) {
      setInterstitial({ finished: interstitial.finished, next })
    } else {
      setInterstitial(null)
      toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: "All retailers complete!" })
      router.push("/dashboard/prices")
    }
  }, [interstitial, completedRetailers, findNextRetailer, router, toast])

  const finishSession = useCallback(() => {
    setInterstitial(null)
    router.push("/dashboard/prices")
  }, [router])
```

- [ ] **Step 6: Gate hotkeys off during the interstitial**

In the hotkey `useEffect` (the one starting `if (!current) return`, ~line 224), change the guard to also
bail during the interstitial, and add `interstitial` to its dependency array:

```ts
  useEffect(() => {
    if (!current || interstitial) return
```

Also add `interstitial` to that same hotkey effect's dependency array (read the actual array in the file
and append `interstitial` — after Task 1 it ends with `reuseLastWeek`).

- [ ] **Step 7: Clear the interstitial when leaving via the picker**

In the retailer-picker buttons' `onClick` (~lines 279-283) add `setInterstitial(null)`:

```ts
                onClick={() => {
                  setRetailer(r)
                  setIndex(0)
                  resetCard()
                  setInterstitial(null)
                }}
```

In the exit "×" button (~line 342) and the empty-deck "← Back to retailer picker" button (~line 320),
add `setInterstitial(null)` alongside `setRetailer(null)`:

```tsx
          onClick={() => { setRetailer(null); setInterstitial(null) }}
```

- [ ] **Step 8: Render the interstitial**

In `sequential-price-entry.tsx`, after the empty-deck `if (deck.length === 0) { ... }` block and before
the `// ── Card flow ──` section (before `const progressWidth = ...`), add:

```tsx
  // ── Between-retailers interstitial ────────────────────────────────────────
  if (interstitial) {
    const nextCount = deckSizeFor(interstitial.next)
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand">
            <Check className="h-6 w-6 text-white" strokeWidth={3} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">Finished {interstitial.finished}</h3>
            <p className="text-sm text-muted-foreground">
              Next up: <span className="font-semibold text-foreground">{interstitial.next}</span> ·{" "}
              {nextCount} product{nextCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <button
              onClick={continueToNext}
              className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-brand/90 transition-colors"
            >
              Continue →
            </button>
            <button
              onClick={skipNextRetailer}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent/60 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={finishSession}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    )
  }
```

- [ ] **Step 9: Add the auto-advance toggle to the card view**

In the card-flow return, immediately after the progress-row `</div>` (the one closing the `flex items-center gap-3`
row, ~line 368) and before the `{/* ── Card stack ── */}` block, add:

```tsx
      {/* Auto-advance retailers toggle */}
      <div className="flex items-center justify-end gap-2">
        <Switch
          id="auto-advance-retailers"
          checked={autoAdvanceRetailers}
          onCheckedChange={setAutoAdvanceRetailers}
          className="scale-90"
        />
        <Label htmlFor="auto-advance-retailers" className="cursor-pointer text-[12px] text-muted-foreground">
          Auto-advance retailers
        </Label>
      </div>
```

- [ ] **Step 10: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 11: Commit**

```bash
git add src/components/prices/sequential-price-entry.tsx
git commit -m "feat(prices): auto-advance across retailers in sequential entry (B2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `pnpm lint` + `pnpm build` clean.

**Manual smoke (deployed build):**
- [ ] B1 sequential: product whose last week was a promo → `L` / "Last week" chip prefills price + promo toggle + original price; non-promo last week → price only (promo off).
- [ ] B1 check form: "Same as last week" on a promo product prefills price + original + promo; non-promo → price only.
- [ ] B2: auto-advance ON → finishing a retailer shows the interstitial; Continue → next incomplete retailer's first card; Skip → jumps past it; retailers already checked this cycle are skipped; Finish / "all complete" → `/prices`.
- [ ] B2: auto-advance OFF → finishing a retailer returns to `/prices` (today's behavior).
- [ ] B2: Enter during the interstitial does NOT double-save (hotkeys gated).
- [ ] Both flows render correctly in light and dark mode.

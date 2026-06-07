# Phase 1 — Record Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the Record Prices page: notes removed, aligned done-state tabs + auto-advance, fixed open-all-URLs, outlier chip + carry-over, inline action chips, atomic save.

**Architecture:** The server page fetches products (URL for the active retailer, latest price per retailer for context/outlier, main image, brand) + retailer check status, ordered via `orderRetailers`. The client form renders the grid, computes outliers/carry-over from passed history, and saves via `recordRetailerPrices`.

**Tech Stack:** Next.js server component + client form, lucide-react, shared `Chip`/`PageHeader`/`PageContainer`.

**Depends on:** Phase 0 (`orderRetailers`, `recordRetailerPrices`, `getRetailerCheckStatus`, `detectPriceOutlier`).

---

## File structure

- Modify: `src/app/(dashboard)/dashboard/prices/check/page.tsx` — data fetch (history, image, brand, status), ordered retailers, pass new props.
- Rewrite: `src/components/prices/price-check-form.tsx` — new layout + logic, no notes, atomic save.

---

### Task 1: Page data — ordered retailers + check status + per-product history

**Files:**
- Modify: `src/app/(dashboard)/dashboard/prices/check/page.tsx`

- [ ] **Step 1: Import the Phase 0 helpers + types**

```ts
import { RETAILERS, orderRetailers } from "@/lib/config/retailers"
import { getRetailerCheckStatus } from "@/app/actions/prices"
import type { PriceHistoryPoint } from "@/lib/outlier"
```

- [ ] **Step 2: Order the retailer tabs** — replace the `retailersToShow` block

```ts
// Only retailers that have >=1 product URL, in canonical config order
const retailersToShow = availableRetailers.length > 0
  ? orderRetailers(availableRetailers)
  : (RETAILERS as readonly string[]).slice()
```

- [ ] **Step 3: Fetch check status + recent prices** alongside the existing parallel fetch

In the `Promise.all`, add a third query for recent prices (last 120 days) for outlier/carry-over context, and call `getRetailerCheckStatus()`:

```ts
const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
const [productsResult, categoriesResult, pricesResult, checkStatus] = await Promise.all([
  supabase.from('products').select(`*, product_urls (*), product_images (*)`).order('name'),
  supabase.from('product_categories').select('id, name'),
  supabase.from('prices').select('product_id, retailer, price, timestamp').gte('timestamp', since).order('timestamp', { ascending: false }),
  getRetailerCheckStatus(),
])
```

- [ ] **Step 4: Build per-product history + main image + lastPrice**

After `categoryMap`, build a history map and extend `formattedProducts`:

```ts
const historyByProduct = new Map<string, PriceHistoryPoint[]>()
for (const row of pricesResult.data || []) {
  if (!row.price || row.price <= 0) continue
  const arr = historyByProduct.get(row.product_id) || []
  arr.push({ retailer: row.retailer, price: row.price, timestamp: row.timestamp })
  historyByProduct.set(row.product_id, arr)
}
```

Extend each formatted product with:

```ts
const history = historyByProduct.get(product.id) || []
const lastAtRetailer = history
  .filter(h => h.retailer === effectiveRetailer)
  .sort((a,b)=> new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.price ?? null
const mainImage = (product.product_images || []).find((im: { is_main?: boolean }) => im.is_main)?.image_url
  || (product.product_images || [])[0]?.image_url || null

return {
  id: product.id,
  name: product.name,
  category: categoryMap.get(product.category_id) || 'Uncategorized',
  brandName: product.brand_name || null,
  imageUrl: mainImage,
  urls: relevantUrls,
  lastPrice: lastAtRetailer,
  history,
}
```

- [ ] **Step 5: Pass new props to the form + remove the old plain tab buttons** — render tabs with done-state and pass `checkStatus`

Replace the retailer button bar with done-aware tabs (a brand-green ring + lucide `Check` when `checkStatus[retailer]` exists) and pass `checkStatus`, then:

```tsx
<PriceCheckForm
  key={effectiveRetailer}
  products={productsWithUrls}
  retailer={effectiveRetailer}
  orderedRetailers={retailersToShow}
/>
```

- [ ] **Step 6: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean (form prop types updated in Task 2).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/dashboard/prices/check/page.tsx"
git commit -m "feat(prices): order retailer tabs + load history/status for record page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite the form — props, no notes, atomic save

**Files:**
- Rewrite: `src/components/prices/price-check-form.tsx`

- [ ] **Step 1: Update the prop/types + drop notes state**

```ts
import { detectPriceOutlier, type PriceHistoryPoint } from "@/lib/outlier"
import { recordRetailerPrices, type PriceStatus } from "@/app/actions/prices"

interface SimpleProduct {
  id: string
  name: string
  category: string
  brandName: string | null
  imageUrl: string | null
  urls: { retailer: string; url: string }[]
  lastPrice: number | null
  history: PriceHistoryPoint[]
}

interface PriceCheckFormProps {
  products: SimpleProduct[]
  retailer: string
  orderedRetailers: string[]
}
```

Remove: `notes` state, the `<Textarea>` notes block, and the `price_check_logs` insert (now handled by the RPC). Keep `prices`, `originalPrices`, `promos`, `soldOut`, `notAvailable`, `category`, `loading`, `autoAdvance`.

- [ ] **Step 2: Replace `handleSubmit` to use `recordRetailerPrices`**

```ts
const handleSubmit = async () => {
  setLoading(true)
  try {
    const ids = Array.from(new Set([
      ...Object.keys(prices).filter(id => prices[id]?.trim()),
      ...Object.keys(soldOut).filter(id => soldOut[id]),
      ...Object.keys(notAvailable).filter(id => notAvailable[id]),
    ]))
    const items = ids.map(id => {
      const status: PriceStatus = notAvailable[id] ? "not_carried" : soldOut[id] ? "out_of_stock" : "active"
      const onSale = !!promos[id]
      const orig = onSale && originalPrices[id] ? parseFloat(originalPrices[id]) : null
      const price = status === "active" ? parseFloat(prices[id]) : 0
      const disc = onSale && orig && price > 0 ? Math.round(((orig - price) / orig) * 100) : null
      return { product_id: id, price, status, is_promotion: onSale, is_sold_out: status === "out_of_stock", original_price: orig, discount_percentage: disc }
    }).filter(i => i.status !== "active" || Number.isFinite(i.price))

    if (items.length === 0) { toast({ title: "No prices entered", variant: "destructive" }); setLoading(false); return }

    await recordRetailerPrices(retailer, items)
    toast({ title: "Success", description: `Price check for ${retailer} completed` })

    if (autoAdvance) {
      const i = orderedRetailers.indexOf(retailer)
      if (i > -1 && i < orderedRetailers.length - 1) {
        router.push(`/dashboard/prices/check?retailer=${encodeURIComponent(orderedRetailers[i + 1])}`)
      } else { toast({ title: "All retailers complete!" }); router.push("/dashboard/prices") }
    } else { router.push("/dashboard/prices") }
    router.refresh()
  } catch (error) {
    toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save", variant: "destructive" })
  } finally { setLoading(false) }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/prices/price-check-form.tsx
git commit -m "refactor(prices): atomic save via recordRetailerPrices, remove notes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Fix "Open all URLs" (synchronous + fallback panel)

**Files:**
- Modify: `src/components/prices/price-check-form.tsx`

- [ ] **Step 1: Replace `openUrlsSequentially` with a synchronous opener + blocked state**

```ts
const [blockedUrls, setBlockedUrls] = useState<string[]>([])

const openAllUrls = (urls: string[]) => {
  const blocked: string[] = []
  for (const u of urls) {
    const w = window.open(u, "_blank", "noopener,noreferrer")
    if (!w) blocked.push(u) // popup blocked
  }
  setBlockedUrls(blocked)
  if (blocked.length) {
    toast({ title: "Some pop-ups were blocked", description: "Use the list below to open the rest.", variant: "destructive" })
  }
}
```

- [ ] **Step 2: Wire the category "Open all" button to `openAllUrls`** and render a fallback panel when `blockedUrls.length > 0`

```tsx
{blockedUrls.length > 0 && (
  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-3">
    <p className="text-xs font-medium mb-2">Pop-ups blocked — open these manually:</p>
    <div className="flex flex-col gap-1">
      {blockedUrls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline truncate">{u}</a>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/prices/price-check-form.tsx
git commit -m "fix(prices): open all URLs synchronously with blocked-popup fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Outlier chip + carry-over + inline action chips + meta row

**Files:**
- Modify: `src/components/prices/price-check-form.tsx`

- [ ] **Step 1: Add an outlier lookup per product** (uses `detectPriceOutlier`)

```ts
const outlierFor = (p: SimpleProduct): { pct: number; reference: number } | null => {
  const raw = prices[p.id]
  if (!raw?.trim() || soldOut[p.id] || notAvailable[p.id]) return null
  const r = detectPriceOutlier({ retailer, newPrice: parseFloat(raw), history: p.history })
  return r ? { pct: r.pct, reference: r.reference } : null
}
```

- [ ] **Step 2: Render the outlier chip directly under each price input** (lucide `TrendingDown`), with a thin amber left-edge on the row when present

```tsx
{(() => { const o = outlierFor(product); return o ? (
  <div className="col-start-2">
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/70 rounded-md px-1.5 py-0.5">
      <TrendingDown className="h-3 w-3" />{Math.round(o.pct)}% was ${o.reference.toFixed(2)}
    </span>
  </div>) : null })()}
```

- [ ] **Step 3: Render the carry-over chip on EMPTY price fields** (lucide `RotateCcw`) when `product.lastPrice != null`

```tsx
{!prices[product.id]?.trim() && !soldOut[product.id] && !notAvailable[product.id] && product.lastPrice != null && (
  <button type="button" onClick={() => handlePriceChange(product.id, product.lastPrice!.toFixed(2))}
    className="col-start-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground border border-dashed rounded-md px-1.5 py-0.5 w-fit">
    <RotateCcw className="h-3 w-3" />Same as last week ${product.lastPrice.toFixed(2)}
  </button>
)}
```

- [ ] **Step 4: Convert Sale/Out/N/A switches to inline chip toggles** (button chips: brand tint when on), keep the existing `handlePromoToggle` / `handleSoldOutToggle` / `handleNotAvailableToggle` logic. Replace the `<Switch>` clusters with `Chip`-styled toggle buttons using lucide `Tag` / `PackageX` / `XCircle`.

- [ ] **Step 5: Replace the header/meta area** — remove the notes block (done in Task 2), remove category divider borders and the footer top-border; add the meta row with the progress bar + a brand `Entered N/M` pill; add the `↵` keycap hint near the sticky Complete button. Trim the auto-advance label to "Auto-advance".

- [ ] **Step 6: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/prices/price-check-form.tsx
git commit -m "feat(prices): outlier chip, carry-over, inline action chips, meta pill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Phase exit

- [ ] `pnpm lint` clean, `pnpm build` succeeds.
- [ ] Push; update the draft PR.
- [ ] **Owner reviews the Vercel preview of `/dashboard/prices/check` and approves** before Phase 2. Verify in both light and dark: done-state tabs, auto-advance order, open-all (+ blocked fallback), outlier chip, carry-over, inline chips, atomic save, no notes.

## Self-review notes
- Spec Phase 1 bullets all covered: notes removed (T2), ordered tabs+done-state (T1), aligned auto-advance (T2), open-all fix (T3), outlier (T4), carry-over (T4), inline chips + meta pill + no dividers + keycap (T4), atomic save (T2).
- `orderedRetailers` prop is the single source for both tab order and auto-advance.
- `detectPriceOutlier` / `recordRetailerPrices` / `PriceStatus` names match Phase 0 exactly.

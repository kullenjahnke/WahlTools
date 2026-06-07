# Phase 2 — Sequential Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild Sequential entry as a retailer-first, keyboard-driven card stack: pick a retailer → one card per product, with last-week fill, open-beside popup, hotkeys, atomic save.

**Architecture:** Server page loads products (URL/image/brand/last-price/history per retailer) + ordered retailers + check status. Client component shows a retailer picker, then a card per product for the chosen retailer; saves each card via `recordRetailerPrices`.

**Tech Stack:** Next.js, lucide-react, shared `Chip`/`PageHeader`.

**Depends on:** Phase 0. Reuses the data-shaping pattern from Phase 1 Task 1.

---

## File structure

- Modify: `src/app/(dashboard)/dashboard/prices/sequential/page.tsx` — load images/brand/last-price/history; pass ordered retailers + check status.
- Rewrite: `src/components/prices/sequential-price-entry.tsx` — retailer picker + card flow.

---

### Task 1: Page data

**Files:**
- Modify: `src/app/(dashboard)/dashboard/prices/sequential/page.tsx`

- [ ] **Step 1: Fetch products + images + recent prices + status**

Mirror Phase 1 Task 1 Steps 3–4: add `product_images (*)` to the select, fetch `prices` (last 120 days), call `getRetailerCheckStatus()`, and build a `history` array + `imageUrl` + `brandName` per product. For each product include the **per-retailer last price** map:

```ts
const lastPriceByRetailer: Record<string, number> = {}
for (const h of history) { // history already newest-first not guaranteed; sort
  // keep first (newest) per retailer
}
```

Shape passed to the component per product:

```ts
{ id, name, category, brandName, imageUrl, urls: {retailer,url}[], history: PriceHistoryPoint[], lastPriceByRetailer: Record<string, number> }
```

- [ ] **Step 2: Pass ordered retailers + status**

```tsx
import { RETAILERS, orderRetailers } from "@/lib/config/retailers"
// retailers that have >=1 product url:
const withUrls = orderRetailers(Array.from(new Set(products.flatMap(p => p.urls.map(u => u.retailer)))))
<SequentialPriceEntry products={products} retailers={withUrls.length ? withUrls : [...RETAILERS]} checkStatus={checkStatus} />
```

- [ ] **Step 3: Verify build** — `pnpm lint && pnpm build` (component types land in Task 2).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/dashboard/prices/sequential/page.tsx"
git commit -m "feat(sequential): load images/last-price/status for card flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Retailer picker step

**Files:**
- Rewrite: `src/components/prices/sequential-price-entry.tsx`

- [ ] **Step 1: New props + retailer-selection state**

```ts
interface SeqProduct {
  id: string; name: string; category: string; brandName: string | null; imageUrl: string | null
  urls: { retailer: string; url: string }[]
  history: PriceHistoryPoint[]
  lastPriceByRetailer: Record<string, number>
}
interface Props { products: SeqProduct[]; retailers: string[]; checkStatus: Record<string, string> }

const [retailer, setRetailer] = useState<string | null>(null)
```

- [ ] **Step 2: Render the picker when `retailer === null`** — chips in `retailers` order, each with a lucide `Check` + brand-green styling when `checkStatus[r]` is set. Selecting sets `retailer` and resets the card index to 0.

- [ ] **Step 3: Compute the product list for the chosen retailer**

```ts
const deck = useMemo(
  () => products.filter(p => p.urls.some(u => u.retailer === retailer)),
  [products, retailer]
)
```

- [ ] **Step 4: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add src/components/prices/sequential-price-entry.tsx
git commit -m "feat(sequential): retailer picker step

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Card flow — layout, last-week fill, open-beside

**Files:**
- Modify: `src/components/prices/sequential-price-entry.tsx`

- [ ] **Step 1: Card state + current product**

```ts
const [index, setIndex] = useState(0)
const [price, setPrice] = useState(""); const [originalPrice, setOriginalPrice] = useState("")
const [isPromo, setIsPromo] = useState(false); const [isSoldOut, setIsSoldOut] = useState(false); const [isNotAvailable, setIsNotAvailable] = useState(false)
const [savedCount, setSavedCount] = useState(0); const [loading, setLoading] = useState(false)
const current = deck[index]
const lastWeek = current ? current.lastPriceByRetailer[retailer!] ?? null : null
const url = current?.urls.find(u => u.retailer === retailer)?.url
```

- [ ] **Step 2: Open-beside popup (positioned, with fallback tab)**

```ts
const openBeside = () => {
  if (!url) return
  const w = Math.min(640, Math.floor(window.screen.availWidth / 2))
  const popup = window.open(url, "wahltools_beside",
    `width=${w},height=${window.screen.availHeight},left=${window.screen.availWidth - w},top=0`)
  if (!popup) window.open(url, "_blank", "noopener,noreferrer")
}
```

- [ ] **Step 3: Render the card** — top progress (✕ exit → back to picker, retailer pill, brand bar `width = index/deck.length`, `index+1 / deck.length` pill); card stack (two ghost divs behind); thumbnail (`imageUrl` or category glyph); name; brand `Chip` + category `Chip`; "Open at {retailer} beside this" button (`openBeside`, key `V`); the green **Last week** chip (`onClick` fills `price`, key `L`) when `lastWeek != null`; big price input (autofocus); Sale/Sold Out/N/A chips with inline hotkey letters; footer `← Back` + **Save & Next**.

- [ ] **Step 4: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add src/components/prices/sequential-price-entry.tsx
git commit -m "feat(sequential): card layout, last-week fill, open-beside popup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Save/advance + hotkeys

**Files:**
- Modify: `src/components/prices/sequential-price-entry.tsx`

- [ ] **Step 1: Save current card via `recordRetailerPrices`, then advance**

```ts
const resetCard = () => { setPrice(""); setOriginalPrice(""); setIsPromo(false); setIsSoldOut(false); setIsNotAvailable(false) }
const advance = () => { resetCard(); if (index < deck.length - 1) setIndex(index + 1); else { toast({ title: "All complete!", description: `Saved ${savedCount} prices.` }); router.push("/dashboard/prices") } }
const goBack = () => { resetCard(); if (index > 0) setIndex(index - 1) }

const save = async () => {
  if (!price && !isSoldOut && !isNotAvailable) { toast({ title: "Enter a price, Sold Out, or N/A", variant: "destructive" }); return }
  setLoading(true)
  try {
    const status: PriceStatus = isNotAvailable ? "not_carried" : isSoldOut ? "out_of_stock" : "active"
    const orig = isPromo && originalPrice ? parseFloat(originalPrice) : null
    const value = status === "active" ? parseFloat(price) : 0
    const disc = isPromo && orig && value > 0 ? Math.round(((orig - value) / orig) * 100) : null
    await recordRetailerPrices(retailer!, [{ product_id: current.id, price: value, status, is_promotion: isPromo, is_sold_out: status === "out_of_stock", original_price: orig, discount_percentage: disc }])
    setSavedCount(c => c + 1); advance()
  } catch (e) { toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to save", variant: "destructive" }) }
  finally { setLoading(false) }
}
```

- [ ] **Step 2: Global hotkeys** (effect bound while a card is shown)

```ts
useEffect(() => {
  if (!current) return
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); save(); return }
    const k = e.key.toLowerCase()
    if (k === "l" && lastWeek != null) { e.preventDefault(); setPrice(lastWeek.toFixed(2)) }
    else if (k === "s") { e.preventDefault(); setIsPromo(v => !v) }
    else if (k === "o") { e.preventDefault(); setIsSoldOut(true); setIsNotAvailable(false); setPrice("") }
    else if (k === "n") { e.preventDefault(); setIsNotAvailable(true); setIsSoldOut(false); setPrice("") }
    else if (k === "v") { e.preventDefault(); openBeside() }
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [current, lastWeek, price, originalPrice, isPromo, isSoldOut, isNotAvailable])
```

- [ ] **Step 3: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 4: Commit**

```bash
git add src/components/prices/sequential-price-entry.tsx
git commit -m "feat(sequential): atomic save, advance, keyboard hotkeys

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Phase exit

- [ ] `pnpm lint` clean, `pnpm build` succeeds.
- [ ] Push; update draft PR.
- [ ] **Owner reviews the Vercel preview of `/dashboard/prices/sequential` and approves** before Phase 3. Verify light/dark: picker done-state, card stack, last-week fill (`L`), open-beside (+ fallback), hotkeys `S/O/N/V/↵`, image thumbnail, atomic save, no skip.

## Self-review notes
- Spec Phase 2 covered: retailer-first (T2), card stack + image + chips (T3), open-beside (T3), last-week fill (T3/T4), hotkeys (T4), no skip / Back+Save&Next (T3/T4), atomic save (T4).
- `recordRetailerPrices` / `PriceStatus` / `PriceHistoryPoint` names match Phase 0.

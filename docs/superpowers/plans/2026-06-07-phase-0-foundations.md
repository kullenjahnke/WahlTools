# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the shared plumbing (retailer ordering, atomic full-status save + extended RPC, outlier detection, 7-day done-state) that Phases 1–2 depend on.

**Architecture:** Pure helpers in `src/lib`, a new server action + extended Postgres RPC for atomic saves, and a read query for retailer freshness. No UI in this phase.

**Tech Stack:** TypeScript, Next.js server actions, Supabase RPC (plpgsql).

---

## File structure

- Modify: `src/lib/config/retailers.ts` — add `orderRetailers`.
- Create: `src/lib/outlier.ts` — `detectPriceOutlier`, `median`, threshold constants.
- Create: `migrations/15_extend_record_price_check.sql` — extended RPC.
- Modify: `src/app/actions/prices.ts` — add `recordRetailerPrices`, `getRetailerCheckStatus`, types.

---

### Task 1: `orderRetailers` helper

**Files:**
- Modify: `src/lib/config/retailers.ts`

- [ ] **Step 1: Append the helper** to `src/lib/config/retailers.ts`

```ts
/**
 * Sort an arbitrary set of retailer names into the canonical config order.
 * Unknown retailers sort to the end (stable). De-duplicates.
 */
export function orderRetailers(available: readonly string[]): string[] {
  const indexOf = (r: string) => {
    const i = (RETAILERS as readonly string[]).indexOf(r)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return Array.from(new Set(available)).sort((a, b) => indexOf(a) - indexOf(b))
}
```

- [ ] **Step 2: Worked example (verify by reading)**

`orderRetailers(['Safeway','Acme','Jewel-Osco'])` → `['Jewel-Osco','Acme','Safeway']`
`orderRetailers(['Acme','Foo','Acme'])` → `['Acme','Foo']` (dupes removed, unknown last)

- [ ] **Step 3: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/config/retailers.ts
git commit -m "feat: add orderRetailers canonical-order helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `detectPriceOutlier` helper

**Files:**
- Create: `src/lib/outlier.ts`

- [ ] **Step 1: Create `src/lib/outlier.ts`**

```ts
export const OUTLIER_LAST_PRICE_PCT = 40
export const OUTLIER_MEDIAN_PCT = 50

export interface PriceHistoryPoint {
  retailer: string
  price: number
  timestamp: string
}

export interface OutlierResult {
  isOutlier: true
  pct: number          // signed % vs reference
  reference: number    // the price we compared against
  basis: "last" | "median"
}

export function median(values: number[]): number {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (v.length === 0) return 0
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * Flag an entered price as a likely outlier.
 * Primary rule: > ±OUTLIER_LAST_PRICE_PCT vs the most recent price at the SAME retailer.
 * Fallback (no same-retailer history): > ±OUTLIER_MEDIAN_PCT vs the cross-retailer
 * median of the latest price per retailer. Returns null when not an outlier.
 */
export function detectPriceOutlier(params: {
  retailer: string
  newPrice: number
  history: PriceHistoryPoint[] // all known prices for the product (any retailer)
}): OutlierResult | null {
  const { retailer, newPrice, history } = params
  if (!Number.isFinite(newPrice) || newPrice <= 0) return null

  const byNewest = [...history]
    .filter((h) => h.price > 0)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const sameRetailer = byNewest.filter((h) => h.retailer === retailer)
  if (sameRetailer.length > 0) {
    const reference = sameRetailer[0].price
    const pct = ((newPrice - reference) / reference) * 100
    return Math.abs(pct) > OUTLIER_LAST_PRICE_PCT
      ? { isOutlier: true, pct, reference, basis: "last" }
      : null
  }

  const latestByRetailer = new Map<string, number>()
  for (const h of byNewest) {
    if (!latestByRetailer.has(h.retailer)) latestByRetailer.set(h.retailer, h.price)
  }
  const med = median([...latestByRetailer.values()])
  if (!med) return null
  const pct = ((newPrice - med) / med) * 100
  return Math.abs(pct) > OUTLIER_MEDIAN_PCT
    ? { isOutlier: true, pct, reference: med, basis: "median" }
    : null
}
```

- [ ] **Step 2: Worked examples (verify by reading)**

- History `[{retailer:'Acme',price:8.49,timestamp:'2026-06-01'}]`, new `1.49` at `Acme` → outlier, `pct ≈ -82.4`, `basis:'last'`.
- History `[{retailer:'Acme',price:8.49,...}]`, new `8.99` at `Acme` → `null` (within 40%).
- History `[{retailer:'Acme',price:8,...},{retailer:'Shaws',price:8,...}]`, new `20` at `Safeway` (no Safeway history) → median 8, `pct=+150` → outlier, `basis:'median'`.

- [ ] **Step 3: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/outlier.ts
git commit -m "feat: add price outlier detection helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Extended `record_price_check` RPC (migration 15)

**Files:**
- Create: `migrations/15_extend_record_price_check.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 15: Extend record_price_check to handle full per-item status/fields
--
-- Adds status (active|out_of_stock|not_carried), is_sold_out, original_price,
-- discount_percentage to the atomic price-check transaction. Backwards compatible:
-- items without these keys default to a plain active price.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION record_price_check(
  p_retailer TEXT,
  p_prices JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: Mark existing active prices historical for these products
  UPDATE prices
  SET status = 'historical'
  WHERE retailer = p_retailer
    AND status = 'active'
    AND product_id IN (
      SELECT (elem->>'product_id')::uuid
      FROM jsonb_array_elements(p_prices) AS elem
    );

  -- Step 2: Insert new prices with full status/fields
  INSERT INTO prices (
    product_id, retailer, price, status,
    is_promotion, is_sold_out, original_price, discount_percentage,
    promotion_notes, timestamp
  )
  SELECT
    (elem->>'product_id')::uuid,
    p_retailer,
    (elem->>'price')::numeric,
    COALESCE(NULLIF(elem->>'status',''), 'active'),
    COALESCE((elem->>'is_promotion')::boolean, false),
    COALESCE((elem->>'is_sold_out')::boolean, false),
    NULLIF(elem->>'original_price','')::numeric,
    NULLIF(elem->>'discount_percentage','')::numeric,
    NULLIF(elem->>'promotion_notes',''),
    NOW()
  FROM jsonb_array_elements(p_prices) AS elem;

  -- Step 3: Log the completed check
  INSERT INTO price_check_logs (retailer, completed, check_date, completed_at, notes)
  VALUES (
    p_retailer, true, NOW(), NOW(),
    COALESCE(p_notes, 'Price check - ' || jsonb_array_length(p_prices) || ' products updated')
  );
END;
$$;
```

- [ ] **Step 2: Run it in Supabase**

Paste into the Supabase SQL Editor for the project and execute. (Cannot be run from CI; document in the PR description that this migration must be applied before the new save path works.)

- [ ] **Step 3: Commit**

```bash
git add migrations/15_extend_record_price_check.sql
git commit -m "feat(db): extend record_price_check RPC for full status/fields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `recordRetailerPrices` + `getRetailerCheckStatus` server actions

**Files:**
- Modify: `src/app/actions/prices.ts`

- [ ] **Step 1: Add the input type + `recordRetailerPrices`** to `src/app/actions/prices.ts` (after the existing `recordPriceCheck`)

```ts
export type PriceStatus = "active" | "out_of_stock" | "not_carried"

export interface PriceEntryInput {
  product_id: string
  price: number
  status: PriceStatus
  is_promotion?: boolean
  is_sold_out?: boolean
  original_price?: number | null
  discount_percentage?: number | null
}

/**
 * Atomic, full-status price save for one retailer. Routes through the extended
 * record_price_check RPC (migration 15). Replaces direct prices writes.
 */
export async function recordRetailerPrices(retailer: string, items: PriceEntryInput[]) {
  try {
    const supabase = await createSupabaseServerClient()
    const p_prices = items.map((i) => ({
      product_id: i.product_id,
      price: i.price,
      status: i.status,
      is_promotion: i.is_promotion ?? false,
      is_sold_out: i.is_sold_out ?? false,
      original_price: i.original_price ?? null,
      discount_percentage: i.discount_percentage ?? null,
    }))

    const { error } = await supabase.rpc("record_price_check", {
      p_retailer: retailer,
      p_prices,
      p_notes: null,
    })
    if (error) throw error

    revalidatePath("/dashboard/prices")
    revalidatePath("/dashboard/prices/history")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Error recording retailer prices:", error)
    throw error
  }
}
```

- [ ] **Step 2: Add `getRetailerCheckStatus`** (rolling 7-day done-state) to the same file

```ts
/**
 * Returns the latest completed-check timestamp per retailer within the rolling
 * last 7 days. Used to show a "done this cycle" indicator.
 */
export async function getRetailerCheckStatus(): Promise<Record<string, string>> {
  try {
    const supabase = await createSupabaseServerClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("price_check_logs")
      .select("retailer, completed_at, check_date, completed")
      .eq("completed", true)
      .gte("check_date", since)

    const map: Record<string, string> = {}
    for (const row of data || []) {
      const at = (row.completed_at as string | null) || (row.check_date as string)
      if (!at) continue
      if (!map[row.retailer] || at > map[row.retailer]) map[row.retailer] = at
    }
    return map
  } catch (error) {
    console.error("Error fetching retailer check status:", error)
    return {}
  }
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm lint && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/prices.ts
git commit -m "feat: add recordRetailerPrices + getRetailerCheckStatus actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Phase exit

- [ ] `pnpm lint` clean, `pnpm build` succeeds.
- [ ] Push branch; open/update the **draft PR** (note in description: "Migration 15 must be applied in Supabase").
- [ ] Phase 0 is non-visual — no preview to review, but confirm the build deploys before starting Phase 1.

## Self-review notes
- Spec §0.1–0.4 all covered (Tasks 1–4).
- `discount_percentage` is a real `prices` column (present in the DB `Row` type); the RPC inserts it.
- `recordRetailerPrices` is the single write path consumed by Phases 1 & 2.

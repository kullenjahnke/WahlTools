# B1 + B2 — Price recording improvements

**Track:** B (Prices / Recording)
**Branch:** `feature/prices-recording-improvements`
**Status:** Approved design — ready for implementation plan

Two related improvements to the price-recording flows, sharing one branch/PR.

---

## B1 — Carry forward last week's sale (original price + promo flag)

### Problem
When reusing last week's price, only the **price** is carried — if the product was on sale that week,
the user must re-enter the original/pre-sale price and re-toggle the promo flag.

### Affected flows
The two flows that already have a "reuse last week" affordance:
- **Sequential entry** — the "Last week" chip + the `L` hotkey (`sequential-price-entry.tsx`).
- **Traditional check form** — the "Same as last week" button (`price-check-form.tsx`).

**Out of scope:** `quick-price-entry.tsx` (the per-product widget) has no reuse affordance today — it
only displays "Current: $X" as text. Not changed.

### Data changes (no DB migration — read-shape only)
Both host pages currently select only `price` from `prices` and build a number-valued "last price".

- **`src/app/(dashboard)/dashboard/prices/sequential/page.tsx`**
  - Extend the `prices` query select to `product_id, retailer, price, timestamp, original_price, is_promotion`.
  - Change `lastPriceByRetailer` from `Record<string, number>` to
    `Record<string, { price: number; original_price: number | null; is_promotion: boolean }>`.
  - Build it from the newest **positive-price** record per retailer (same selection rule as today),
    capturing the three fields. (`history` / `PriceHistoryPoint` for outlier detection stays
    `{ retailer, price, timestamp }`.)

- **`src/app/(dashboard)/dashboard/prices/check/page.tsx`**
  - Extend the `prices` query select to add `original_price, is_promotion`.
  - On each `SimpleProduct`, keep `lastPrice: number | null` (display logic depends on it) and add
    `lastOriginalPrice: number | null` and `lastWasPromo: boolean`, taken from the same newest
    positive-price record that produces `lastPrice`.

### Component changes
- **`src/components/prices/sequential-price-entry.tsx`**
  - `SeqProduct.lastPriceByRetailer` type updated to the object shape.
  - `lastWeek` derivation: `const lastWeek = current.lastPriceByRetailer[retailer] ?? null`
    (object | null); the chip displays `lastWeek.price`.
  - Reuse (the "Last week" button onClick AND the `L` hotkey): set price to `lastWeek.price`; then if
    `lastWeek.is_promotion && lastWeek.original_price` → set promo on and prefill the original-price
    field with `lastWeek.original_price`; otherwise set promo off and clear the original-price field.
    (Still also clears sold-out / N/A as today.) Extract a small shared `reuseLastWeek()` helper so the
    button and hotkey don't diverge.

- **`src/components/prices/price-check-form.tsx`**
  - `SimpleProduct` gains `lastOriginalPrice` / `lastWasPromo`.
  - The "Same as last week" button: replace the inline `handlePriceChange(...)` with a
    `carryOverLastWeek(product)` helper that sets the price and, when `lastWasPromo && lastOriginalPrice`,
    also toggles promo on and prefills `originalPrices[id]`; otherwise leaves promo off.

### Notes
- Carried values remain fully editable.
- If the newest record was sold-out/N/A (price ≤ 0), the carry falls back to the prior positive-price
  record — identical to today's "last price" behavior; its promo fields ride along.

---

## B2 — Auto-advance across retailers in sequential entry

### Problem
Sequential entry does one retailer per session — after finishing a retailer the user must return to the
picker and choose the next one. (The traditional check form already auto-advances retailers; this adds
the equivalent to sequential.)

### Design (all in `src/components/prices/sequential-price-entry.tsx`)
- **Toggle:** an "Auto-advance retailers" switch, **default on**, mirroring the check form's
  Switch + Label. When **off**, finishing a retailer behaves as today (completion toast → `/prices`).
- **Order:** the `retailers` prop is already canonical-ordered (`withUrls` via `orderRetailers`).
  Auto-advance moves **forward** through that order from the chosen starting retailer.
- **Skip-completed:** maintain `completedRetailers: Set<string>`, seeded from the truthy keys of the
  `checkStatus` prop (already checked this cycle) and extended with each retailer finished in-session.
  The "next" retailer is the next forward entry that is **not** in `completedRetailers` **and** has a
  non-empty deck (≥1 product carrying that retailer's URL).
- **Interstitial:** when a deck's last card is saved and the toggle is on and a next retailer exists,
  render a between-retailers card (instead of a product card):
  > ✓ **{finished}** complete — Next up: **{next}** ({N} products)

  with three actions:
  - **Continue** → `setRetailer(next)`, `setIndex(0)`, reset card, clear interstitial (the existing
    focus effect focuses the price input).
  - **Skip** → recompute the next forward incomplete retailer **after** `next`; if one exists, update
    the interstitial to it; else finish.
  - **Finish** → completion toast → `/prices`.

  When no incomplete retailer remains after a deck finishes → "All retailers complete" toast →
  `/prices`.
- `savedCount` remains a running total across retailers. Deck/index reset on each retailer change
  (existing behavior).

### Scope notes
- Forward-only from the chosen starting retailer (start at the top to cover everything).
- No change to the traditional check form's existing retailer auto-advance.
- No DB/migration changes.

---

## Verification (both B1 + B2)

No test runner. Verify with `pnpm lint` + `pnpm build` (clean). Design every touched surface for light
and dark mode.

**Manual smoke (deployed build):**
- B1 sequential: a product whose last week was a promo → press `L` / click "Last week" → price,
  promo toggle, and original price all prefill; a non-promo last week → only price prefills (promo off).
- B1 check form: "Same as last week" on a promo product prefills price + original price + promo; on a
  non-promo product prefills price only.
- B2: with auto-advance on, finishing a retailer shows the interstitial; Continue moves to the next
  incomplete retailer; Skip jumps past it; already-checked retailers (per check-status) are skipped;
  Finish / "all complete" returns to `/prices`. With the toggle off, finishing returns to `/prices` as
  today.
- Both flows render correctly in light and dark mode.

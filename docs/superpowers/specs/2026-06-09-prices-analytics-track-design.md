# Prices & Analytics Track — Design Spec

**Date:** 2026-06-09
**Status:** Approved (brainstorming complete)
**Track:** Ryan's "Prices & Analytics" feature requests — a separate track carved out of the
Social Calendar Phase 3 umbrella spec (`2026-06-08-social-calendar-phase3-design.md`, section
"Out of scope / separate track"). This is **not** social-calendar work.

## Overview

Three independent features, each shipping on its **own branch** and its **own PR**:

| # | Feature | Branch | Formal plan? |
|---|---------|--------|--------------|
| 1 | Prices quick wins (Fresh default + remove HyVee) | `feature/prices-quick-wins` | No — fast PR |
| 2 | Analytics chart-export image | `feature/analytics-chart-export` | Yes |
| 3 | Prior-week price entry/adjustment | `feature/prior-week-price-entry` | Yes |

Do **not** bundle features into one PR. Each is independent and can ship in any order.

**Repo conventions (apply to all three):**
- No test runner. Verify every task with `pnpm lint` + `pnpm build`, plus manual smoke via the
  preview tools where the change is visible in the browser. Design every surface for **both light
  and dark mode**.
- Branch off `main`; commit logically; open a PR (never push to `main`).
- `gh pr edit` / `gh pr merge` error on this repo (classic-projects deprecation) — use the REST API
  for body edits/merges: `gh api -X PATCH/PUT repos/kullenjahnke/WahlTools/pulls/<n> …`.
  `gh pr create` works.
- End commit messages with the `Co-Authored-By` trailer; end PR bodies with the Claude Code footer.

---

## Feature 1 — Prices quick wins

Small, mechanical changes. One fast PR, no formal plan.

### 1a. Default the Freshness filter to "Fresh"

- **File:** `src/components/prices/retailer-price-table.tsx`.
- **Change:** the freshness filter state default (`useState<FreshnessFilter>("all")`, line ~92) →
  `useState<FreshnessFilter>("active")`.
- **Rationale:** the `active` cell-state *is* "Fresh" — `priceState()` returns `active` for a real
  price recorded inside the staleness window. Defaulting here means the table opens showing only
  fresh prices.
- The "Clear filters" reset already resets this to `"all"` and should remain unchanged (clearing
  shows everything).
- **Verify:** Prices table opens filtered to fresh prices; the Freshness control reads "Active";
  clearing filters returns to "All". Check light + dark.

### 1b. Remove HyVee from the Prices table

**Root cause:** in `retailer-price-table.tsx` (~line 119‑126), `relevantRetailers` is built purely
from the retailer values found in price rows, with **no check against the configured 9 retailers**.
Stray `retailer='HyVee'` rows therefore surface as a table column. HyVee is **not** in
`src/lib/config/retailers.ts`.

Two parts, in this order:

1. **Exclusion (code) — ships first, non-destructive.**
   Filter `relevantRetailers` against the `RETAILERS` config so only configured retailers can ever
   render: `.filter((r) => (RETAILERS as readonly string[]).includes(r))`. This makes HyVee — or any
   future non-config retailer — disappear from the UI immediately, independent of the DB.

2. **DB cleanup (destructive, gated) — last, only after explicit confirmation.**
   The stray rows still pollute queries/exports, so delete them. **This delete is irreversible and
   must be gated:**
   - First, run the dev server and **confirm Ryan actually sees HyVee** on the Prices page.
   - Then run a **read-only** count/preview:
     `SELECT id, product_id, price, status, timestamp FROM prices WHERE retailer = 'HyVee';`
     and show the exact rows.
   - Only after Ryan confirms **those specific rows**, run
     `DELETE FROM prices WHERE retailer = 'HyVee';`
   - The code exclusion (part 1) and the DB delete (part 2) may ship as separate confirmed steps.

**Verify:** HyVee no longer appears as a column or in the retailer filter (light + dark); the 9
configured retailers are unaffected; exports no longer contain HyVee.

---

## Feature 2 — Analytics chart-export image

Export a stylized PNG of a product's price chart + retailer metrics (with the currently applied
settings), including the product image, title, and a "Powered by WahlTools" mark.

### Surface & scope

- Lives on `/dashboard/analytics` (`src/components/analytics/product-analytics.tsx`).
- The **Export** button appears only in **"Retailer" mode** — the only mode with a single selected
  product (so it has one product image + title). It is hidden/disabled in product and category
  modes. Disabled when there is no chart data for the current selection.
- Output: **PNG**, filename `{product-slug}-prices-{range}.png` (e.g.
  `classic-beef-patties-prices-90d.png`).

### Layout (locked: "Option B v3", landscape card)

A landscape card composed of:
- **Left column:** product image (rounded thumb) + product title + brand; below it the **retailer
  metrics** table (retailer swatch + name, Avg, WoW) — the same metrics already computed on the page.
- **Right column:** a "**Prices**" heading with a rounded **range pill** (e.g. "90 days"), and the
  price-over-time chart **filling the panel**.
- **Footer:** "Generated {date}" on the left; a green **"Powered by WahlTools"** mark on the right.
- No green top bar.

### Rendering approach (fidelity + theming)

- Build a dedicated **off-screen `ChartExportCard`** component composed from the **real themed
  components**: a real Recharts `LineChart` at a **fixed pixel size** with
  `isAnimationActive={false}`, the real `RETAILER_COLORS` / `SERIES_PALETTE`, and the app's CSS
  design tokens.
- Rasterize the card node with **`html-to-image`** (new dependency — lighter than html2canvas, good
  SVG/Recharts support). `toPng(node)` → trigger a download.
- Because the card uses the live themed DOM, the export **matches the current light/dark theme**
  automatically (correct foreground text in dark mode, platform colors, no stretched chart).
- The card is rendered off-screen (e.g. a fixed-position container far off-viewport or a portal),
  measured at a fixed width (~760px) so the chart is crisp; capture after the chart has painted
  (next tick / `requestAnimationFrame`).

### Risks / notes

- The Supabase product image must be **CORS-fetchable** for `html-to-image` to inline it; if the
  bucket blocks it, fall back to fetching the image as a blob (or data URL) first and feeding that to
  the card. Verify during implementation.
- Keep the export card's data derived from the **same `series` / `metrics`** the live page already
  computes, so "current settings" (selected product, time range, toggled-off retailers) are honored.

**Verify:** in Retailer mode, pick a product → Export → a PNG downloads matching Option B v3 with the
correct product, chart, metrics, and theme. Confirm light + dark. Confirm the button is absent in
product/category modes.

---

## Feature 3 — Prior-week price entry/adjustment

Add or adjust a product's price at any retailer for a **past week**, from the Price History page.

### Data model background

- The `prices` table's `status` column is **overloaded**: it carries both lifecycle
  (`active` / `historical`) and availability (`out_of_stock`). The **current** price for a
  product+retailer is the **latest-timestamp row** (the Prices table and history compute "current"
  by timestamp, not by the `active` flag).
- "N/A" (no longer carried) = `price <= 0` and not sold out. "Sold out" = `status='out_of_stock'`
  or `is_sold_out=true`.
- Week boundaries are **Monday 00:00 America/New_York**, matching `getWeekStartEST` in
  `src/app/actions/prices.ts` and `product-analytics.tsx`.
- Week-over-week stats (`getPriceChangeStats`, dashboard) and the analytics WoW bucket purely by
  **timestamp** into current-week / previous-week.

### Surface

- A **dialog** launched from the **Price History** page
  (`src/components/prices/product-history-view.tsx`) via an "Add / adjust past price" button,
  pre-scoped to the currently-selected product.
- **Dialog fields:**
  - **Retailer** — select from the 9 configured retailers.
  - **Week** — a picker listing the last ~16 **completed** weeks (strictly before the current week),
    each labeled "Week of Mon, MMM d", **with the existing value for that product+retailer+week shown
    inline** (so it's obvious whether you're adding or adjusting).
  - **Value** — a numeric **price**, OR mark **Sold out**, OR mark **N/A** (mirrors the availability
    options of the normal price-check flow).
- Scope: **weeks strictly before the current week.** Current-week entry stays in the normal
  record-prices flow. This keeps the two flows cleanly separated.

### Save semantics

One representative value per **product + retailer + week** — saving **replaces** that week's entry.

### New atomic RPC: `upsert_historical_price`

New SQL migration (next number after `24` → `25_upsert_historical_price.sql`). Signature:

```
upsert_historical_price(
  p_product_id  uuid,
  p_retailer    text,
  p_week_start  timestamptz,   -- Monday 00:00 EST of the target week
  p_price       numeric,
  p_status      text,          -- availability: 'active' (normal price) | 'out_of_stock' (sold out)
  p_is_sold_out boolean
) RETURNS void
```

Availability mapping the server action uses:
- **Price:** `p_price = value`, `p_status = 'active'`, `p_is_sold_out = false`.
- **Sold out:** `p_price = 0`, `p_status = 'out_of_stock'`, `p_is_sold_out = true`.
- **N/A:** `p_price = 0`, `p_status = 'historical'`, `p_is_sold_out = false` (N/A is detected by
  `price <= 0 AND NOT sold out`, so the lifecycle value is irrelevant to rendering).

Step 4 below only governs the `active`/`historical` lifecycle of **available** rows; sold-out / N/A
rows are excluded from that recompute and keep the status set here.

Steps (single transaction, `SECURITY DEFINER`, matching existing RPC style in migration 15):

1. Compute the window `[p_week_start, p_week_start + interval '7 days')`.
2. **Delete** existing `prices` rows for `(p_product_id, p_retailer)` whose `timestamp` falls in that
   window (the "replace").
3. **Insert** one row: timestamp = `p_week_start + interval '12 hours'` (Monday noon EST — clearly
   inside the week, stable across re-saves), with the chosen price / `is_sold_out` /
   availability status.
4. **Re-assert the active invariant** for `(p_product_id, p_retailer)`: the **max-timestamp
   *available* row** (not sold-out, not N/A) gets `status='active'`; all other available rows get
   `status='historical'`. Sold-out / N/A rows keep their availability status (lifecycle treated as
   historical).

This invariant is self-healing and handles every case:
- Backfilling an **older** week → a newer active row already exists → the new row is `historical`;
  the current price (Prices table latest-by-timestamp, dashboard active-count) is **untouched**.
- Adjusting the **most-recent** known week (e.g. a stale retailer's latest) → the new row legitimately
  becomes the most recent → it becomes `active`, which matches what the Prices table already shows
  by timestamp.

### WoW / analytics interaction (by design)

Because WoW buckets by timestamp, correcting a past week **flows correctly into** the dashboard WoW
buckets and the Analytics WoW column. That is the intended behavior — editing history fixes the
derived stats. The Monday-noon anchor guarantees the row lands in the intended week's bucket.

### Server action

New action in `src/app/actions/prices.ts`, e.g.
`recordHistoricalPrice({ productId, retailer, weekStart, price, status, isSoldOut })`, which calls
the RPC and then `revalidatePath` for `/dashboard/prices`, `/dashboard/prices/history`,
`/dashboard`, and `/dashboard/analytics`.

**Verify:** from Price History, open the dialog, pick a retailer + a past week with no data → save a
price → it appears in the chart/change-log at that week and the dashboard/analytics WoW updates;
re-saving the same week **replaces** (no duplicate point); the current/"latest" price on the Prices
table is unchanged when backfilling older weeks; backfilling sold-out / N/A renders correctly.
Confirm light + dark.

---

## Out of scope (this track)

- Any social-calendar work (Phase 2 publishing, Phase 3 Features A/B/E are merged and untouched).
- Sub-daily cron / scheduling changes.
- Refactoring the overloaded `status` column (noted as background; not changed here).

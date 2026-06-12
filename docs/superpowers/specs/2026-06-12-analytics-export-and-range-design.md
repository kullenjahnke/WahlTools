# C1 + C2 + C3 — Analytics chart export & date range

**Track:** C (Analytics)
**Branch:** `feature/analytics-export-and-range`
**Status:** Approved design — ready for implementation plan

Three related improvements to the Analytics page, sharing one branch/PR. Builds on the existing
single-product "Compare by Retailer" PNG export (`chart-export-card.tsx`, `product-analytics.tsx`,
`export-chart.ts`).

---

## C3 — "All" date-range option (Analytics page only)

### Change
Add an "All time" option to the time-range selector and wire it through the existing `cutoffMs` logic.

- `src/components/analytics/product-analytics.tsx`:
  - `TIME_RANGES` gains `{ value: "all", label: "All time" }` (after the 1-year entry).
  - `cutoffMs` (`useMemo`): return `0` when `timeRange === "all"`; otherwise unchanged. The existing
    `aggregateByDate` (`if (cutoffMs && t < cutoffMs)`) and the retailer-series filter
    (`new Date(p.timestamp).getTime() >= cutoffMs`) already treat `cutoffMs === 0` as "no cutoff", so
    "All time" shows the full history.
  - `rangeLabel` (`useMemo`): for `timeRange === "all"` it resolves to "All time" (the `replace(/^Last\s+/i, "")`
    is a no-op on "All time"); this drives the export pill + filename.

### Scope
Analytics page only. The Prices › History selector (`product-price-history.tsx`) and the
legacy/unused comparison-history + `price-history-chart` are **not** changed.

---

## C1 — Extend PNG export to Compare-by-Product and Compare-by-Category

### `src/components/analytics/chart-export-card.tsx`
Replace the three product-specific props (`productName`, `brandName`, `imageDataUrl`) with a header
discriminated union, and add the themed logo prop:

```ts
export type ExportHeader =
  | { kind: "product"; productName: string; brandName: string | null; imageDataUrl: string | null }
  | { kind: "comparison"; title: string; subtitle: string; icon: "product" | "category" }

export interface ChartExportCardProps {
  header: ExportHeader
  logoDataUrl: string | null   // C2 — themed logo, see below
  rangeLabel: string
  generatedLabel: string
  series: ExportSeries[]
  metrics: ExportMetric[]
  chartData: Array<Record<string, string | number>>
}
```

Header rendering (left panel):
- `kind: "product"` — the current layout: product image (or `Package` fallback) + product name + brand.
- `kind: "comparison"` — the mode icon (`Package` for `icon: "product"`, `Tags` for `icon: "category"`)
  in the same icon slot, plus the `title` and a `subtitle` line.

The metrics table, chart, range pill, and footer are otherwise unchanged (they already render generic
`series` / `metrics` / `chartData`).

### `src/components/analytics/product-analytics.tsx`
- Remove the retailer-only gate on both the Export button and `handleExport`. The Export button shows
  in **every** mode whenever `chartData.length > 0`.
- `handleExport` builds the header by mode:
  - `retailer` → `{ kind: "product", productName, brandName, imageDataUrl }` (requires `selectedProduct`;
    if missing, bail).
  - `product` → `{ kind: "comparison", title: "Product comparison", subtitle: "${visibleSeries.length} products", icon: "product" }`.
  - `category` → `{ kind: "comparison", title: "Category comparison", subtitle: "${visibleSeries.length} categories", icon: "category" }`.
- `visibleSeries` / `metrics` / `chartData` already exclude hidden (toggled-off) series, so the export
  honors selected products/categories, the time range, and toggled-off series automatically. Product
  mode emits **all selected products in one image** (multi-series chart + one metrics row each).
- **Filenames:** retailer `${slug(productName)}-prices-${slug(rangeLabel)}.png`; product
  `product-comparison-${slug(rangeLabel)}.png`; category `category-comparison-${slug(rangeLabel)}.png`.
  The export payload state carries the computed `filename` alongside the card props so the rasterize
  effect uses it (today it derives the filename from `productName`, which no longer exists for
  comparison headers).

---

## C2 — Theme-adaptive logo footer

Replace the footer's brand-green square + "Powered by WahlTools" text with "Powered by" + the
WahlTools logo image (`public/email-logo.png`, a 600×134 **white** wordmark).

### `src/lib/analytics/export-chart.ts`
Add a helper that returns a theme-correct logo data URL (deterministic — does not rely on CSS filters
rasterizing through html-to-image):

```ts
/**
 * Load the white WahlTools wordmark and return a data URL recolored for the theme:
 * white for dark exports, black for light exports (recolor via 'source-in'). Null on failure.
 */
export async function themedLogoDataUrl(isDark: boolean): Promise<string | null>
```

Implementation: load `/email-logo.png` into an `Image` (same-origin), draw it onto a canvas; for the
light theme (`!isDark`), set `ctx.globalCompositeOperation = "source-in"` and fill the canvas with
black (recolors the opaque pixels, preserving alpha); for dark, keep it white. Export as a PNG data
URL. Resolve `null` on any load/draw failure.

### `src/components/analytics/chart-export-card.tsx` (footer)
- Left: `generatedLabel` in `text-muted-foreground` (unchanged).
- Right: "Powered by" in `text-muted-foreground` + `<img src={logoDataUrl} … />` sized ~16px tall,
  width auto (≈72px from the 600×134 ratio). If `logoDataUrl` is `null`, fall back to the previous
  "WahlTools" text.
- Because the off-screen export card renders inside the live themed DOM, `text-muted-foreground`
  adapts and the recolored logo matches: black logo + dark text on a light card; white logo + light
  text on a dark card. No dark bar/pill required.

### `handleExport`
Detect the theme via `document.documentElement.classList.contains("dark")`, call
`themedLogoDataUrl(isDark)`, and pass the result as `logoDataUrl`.

---

## Out of scope
- No DB/migration (all client-side).
- No change to chart rendering, the metrics computation, or the on-page (non-export) UI beyond the
  range option + export-button gating.
- Prices › History and legacy charts (C3 scope note).

## Error handling
- Logo load failure → `logoDataUrl: null` → footer falls back to "WahlTools" text.
- Product/category export with no visible series → `chartData.length === 0` → Export button hidden
  (same guard as today).
- Retailer export with no selected product → `handleExport` bails (guard retained).

## Verification

No test runner. Verify with `pnpm lint` + `pnpm build` (clean). The export runs client-side on the
off-screen card; live data needs the deployed build (local Supabase creds are placeholders).

**Manual smoke (deployed build):**
- C3: "All time" appears in the range selector; selecting it shows full history; the export pill +
  filename read "all-time".
- C1: Export PNG works in Retailer (unchanged), Product (multi-product comparison in one image, icon +
  "Product comparison" + count), and Category (icon + "Category comparison" + count); toggling a
  series off excludes it from the exported chart, metrics, and legend.
- C2: the footer logo reads correctly in BOTH a light-theme export and a dark-theme export ("Powered
  by" + logo legible in each).

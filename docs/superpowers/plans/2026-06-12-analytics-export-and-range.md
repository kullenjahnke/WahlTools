# C1 + C2 + C3 — Analytics Export & Range Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "All time" range (C3), extend the PNG export to Product & Category compare modes (C1), and replace the footer wordmark with a theme-adaptive WahlTools logo (C2).

**Architecture:** C3 is a small change to `product-analytics.tsx`'s range config + `cutoffMs`. C2 adds a deterministic canvas-recolor logo helper to `export-chart.ts`. C1 reshapes `ChartExportCard` to a header union and wires `handleExport` to build per-mode headers + filenames + the themed logo. All client-side, no DB.

**Tech Stack:** React client components, Recharts, html-to-image, canvas. No test runner — verification is `pnpm lint` + `pnpm build` plus manual smoke on the deployed build (export needs live data).

---

## Note on verification
No unit-test runner. Each task's gate is `pnpm lint` + `pnpm build` (both clean). Design every touched
surface for **light and dark** (the export is explicitly theme-adaptive). Live export smoke is on the
deployed build.

## File Structure
- **Modify** `src/components/analytics/product-analytics.tsx` — "All" range (C3) + export wiring (C1/C2).
- **Modify** `src/lib/analytics/export-chart.ts` — `themedLogoDataUrl` helper (C2).
- **Modify** `src/components/analytics/chart-export-card.tsx` — header union (C1) + logo footer (C2).

Order: Task 1 (C3) → Task 2 (logo helper) → Task 3 (card + component integration).

---

## Task 1: C3 — "All time" range option

**File:** Modify `src/components/analytics/product-analytics.tsx`.

- [ ] **Step 1: Add the range option**

Change `TIME_RANGES` (~lines 63-68) to add an "All time" entry:

```ts
const TIME_RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
  { value: "365", label: "Last 1 year" },
  { value: "all", label: "All time" },
]
```

- [ ] **Step 2: Handle "all" in `cutoffMs`**

Change the `cutoffMs` `useMemo` (~lines 167-171) to short-circuit "all" to `0`:

```ts
  const cutoffMs = useMemo(() => {
    if (timeRange === "all") return 0
    const days = parseInt(timeRange)
    const cutoff = days <= 90 ? subDays(new Date(), days) : subMonths(new Date(), days / 30)
    return cutoff.getTime()
  }, [timeRange])
```

(No change to `rangeLabel` — `"All time".replace(/^Last\s+/i, "")` is a no-op, so the pill/filename read
"All time". The existing `aggregateByDate` `if (cutoffMs && t < cutoffMs)` and the retailer-series
`>= cutoffMs` filter already treat `0` as "no cutoff".)

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/product-analytics.tsx
git commit -m "feat(analytics): add All time range option (C3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: C2 — themed logo helper

**File:** Modify `src/lib/analytics/export-chart.ts`.

- [ ] **Step 1: Append `themedLogoDataUrl`**

Add at the end of `src/lib/analytics/export-chart.ts`:

```ts
const LOGO_URL = "/email-logo.png"

/**
 * Load the white WahlTools wordmark and return a PNG data URL recolored for the theme:
 * kept white for dark exports, recolored to black for light exports (via 'source-in', which
 * preserves alpha). Same-origin asset, so the canvas isn't tainted. Resolves null on any failure.
 */
export function themedLogoDataUrl(isDark: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        if (!isDark) {
          // Recolor opaque pixels to black, preserving alpha (the wordmark shape).
          ctx.globalCompositeOperation = "source-in"
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = LOGO_URL
  })
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/export-chart.ts
git commit -m "feat(analytics): theme-adaptive logo data-url helper (C2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: C1 + C2 — header union card + export wiring

**Files:** Modify `src/components/analytics/chart-export-card.tsx`, `src/components/analytics/product-analytics.tsx`.

- [ ] **Step 1: Reshape `ChartExportCard` props (header union + logo)**

In `chart-export-card.tsx`:

Add `Tags` to the lucide import:

```ts
import { Package, Tags } from "lucide-react"
```

Replace the `ChartExportCardProps` interface (the block with `productName`/`brandName`/`imageDataUrl`)
with the header union + logo prop:

```ts
export type ExportHeader =
  | { kind: "product"; productName: string; brandName: string | null; imageDataUrl: string | null }
  | { kind: "comparison"; title: string; subtitle: string; icon: "product" | "category" }

export interface ChartExportCardProps {
  header: ExportHeader
  /** Theme-adaptive WahlTools logo data URL for the footer, or null to fall back to text. */
  logoDataUrl: string | null
  /** Short range label for the pill, e.g. "90 days". */
  rangeLabel: string
  /** Footer line, e.g. "Generated Jun 9, 2026". */
  generatedLabel: string
  series: ExportSeries[]
  metrics: ExportMetric[]
  chartData: Array<Record<string, string | number>>
}
```

- [ ] **Step 2: Update the destructure + header render**

Change the `forwardRef` function param destructure from
`{ productName, brandName, imageDataUrl, rangeLabel, generatedLabel, series, metrics, chartData }` to:

```ts
    { header, logoDataUrl, rangeLabel, generatedLabel, series, metrics, chartData },
```

Replace the header block (the `<div className="mb-4 flex items-center gap-3"> … </div>` containing the
image + product name) with:

```tsx
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {header.kind === "product" ? (
                  header.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={header.imageDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )
                ) : header.icon === "category" ? (
                  <Tags className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                {header.kind === "product" ? (
                  <>
                    <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                      {header.productName}
                    </div>
                    {header.brandName && (
                      <div className="text-xs text-muted-foreground">{header.brandName}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                      {header.title}
                    </div>
                    <div className="text-xs text-muted-foreground">{header.subtitle}</div>
                  </>
                )}
              </div>
            </div>
```

- [ ] **Step 3: Replace the footer with the themed logo**

Replace the footer block (the `<div className="flex items-center justify-between border-t … ">` with
`generatedLabel` + "Powered by WahlTools") with:

```tsx
        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
          <span>{generatedLabel}</span>
          <span className="flex items-center gap-1.5">
            <span>Powered by</span>
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="WahlTools" className="h-4 w-auto" />
            ) : (
              <span className="font-semibold text-brand">WahlTools</span>
            )}
          </span>
        </div>
```

- [ ] **Step 4: Wire `handleExport` + state + effect in `product-analytics.tsx`**

In `product-analytics.tsx`:

Update the export-chart import to add the logo helper:

```ts
import { slugify, imageToDataUrl, exportNodeToPng, themedLogoDataUrl } from "@/lib/analytics/export-chart"
```

Update the card-type import to also bring the header type:

```ts
import {
  ChartExportCard,
  type ChartExportCardProps,
  type ExportHeader,
} from "@/components/analytics/chart-export-card"
```

Change the export-data state (currently `useState<ChartExportCardProps | null>(null)`) to carry the
filename:

```ts
  const [exportData, setExportData] = useState<{ props: ChartExportCardProps; filename: string } | null>(null)
```

Replace the whole `handleExport` `useCallback` with:

```ts
  const handleExport = useCallback(async () => {
    if (chartData.length === 0 || exportingRef.current) return
    if (mode === "retailer" && !selectedProduct) return
    exportingRef.current = true
    try {
      const isDark = document.documentElement.classList.contains("dark")
      const logoDataUrl = await themedLogoDataUrl(isDark)

      let header: ExportHeader
      let filename: string
      if (mode === "retailer") {
        const imageDataUrl = selectedProduct!.imageUrl
          ? await imageToDataUrl(selectedProduct!.imageUrl)
          : null
        header = {
          kind: "product",
          productName: selectedProduct!.name,
          brandName:
            selectedProduct!.brand_type === "wahlburgers"
              ? "Wahlburgers"
              : selectedProduct!.brand_name || null,
          imageDataUrl,
        }
        filename = `${slugify(selectedProduct!.name)}-prices-${slugify(rangeLabel)}.png`
      } else if (mode === "product") {
        header = {
          kind: "comparison",
          title: "Product comparison",
          subtitle: `${visibleSeries.length} products`,
          icon: "product",
        }
        filename = `product-comparison-${slugify(rangeLabel)}.png`
      } else {
        header = {
          kind: "comparison",
          title: "Category comparison",
          subtitle: `${visibleSeries.length} categories`,
          icon: "category",
        }
        filename = `category-comparison-${slugify(rangeLabel)}.png`
      }

      setExportData({
        props: {
          header,
          logoDataUrl,
          rangeLabel,
          generatedLabel: `Generated ${format(new Date(), "MMM d, yyyy")}`,
          series: visibleSeries.map((s) => ({ key: s.key, label: s.label, color: s.color })),
          metrics: metrics.map((m) => ({
            key: m.key,
            label: m.label,
            color: m.color,
            avg: m.avg,
            wowChange: m.wowChange,
          })),
          chartData,
        },
        filename,
      })
    } finally {
      exportingRef.current = false
    }
  }, [mode, selectedProduct, rangeLabel, visibleSeries, metrics, chartData])
```

- [ ] **Step 5: Update the rasterize effect + off-screen render to use the new shape**

In the export `useEffect` (the one keyed on `[exportData]`), replace the `exportNodeToPng(...)` call's
filename argument so it uses the carried filename:

```ts
        await exportNodeToPng(exportRef.current, exportData.filename)
```

(The rest of the effect — the double-RAF, the `setExportData(null)` in `finally` — is unchanged.)

Update the off-screen render at the bottom to spread `exportData.props`:

```tsx
      {exportData && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}
        >
          <ChartExportCard ref={exportRef} {...exportData.props} />
        </div>
      )}
```

- [ ] **Step 6: Show the Export button in every mode**

Change the Export button gate (~line 504) from `mode === "retailer" && chartData.length > 0` to just
`chartData.length > 0`:

```tsx
              {chartData.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!!exportData}
                  className="h-8"
                >
                  <Download className="size-4" />
                  {exportData ? "Exporting…" : "Export PNG"}
                </Button>
              )}
```

- [ ] **Step 7: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both clean (no leftover references to the old `productName`/`imageDataUrl` props or the old
`exportData.productName`).

- [ ] **Step 8: Commit**

```bash
git add src/components/analytics/chart-export-card.tsx src/components/analytics/product-analytics.tsx
git commit -m "feat(analytics): export for product/category modes + logo footer (C1+C2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] `pnpm lint` + `pnpm build` clean.

**Manual smoke (deployed build):**
- [ ] C3: "All time" appears in the range selector; selecting it shows the full history; the export pill + filename read "all-time".
- [ ] C1 Retailer: export unchanged (product image + name header).
- [ ] C1 Product: Export PNG produces ONE image with all selected products (multi-series chart + a metrics row per product), header = Package icon + "Product comparison" + "{n} products".
- [ ] C1 Category: header = Tags icon + "Category comparison" + "{n} categories".
- [ ] C1: toggling a series off excludes it from the exported chart, legend, and metrics.
- [ ] C2: the footer "Powered by" + logo is legible in BOTH a light-theme export and a dark-theme export.
- [ ] Filenames: `{product}-prices-…`, `product-comparison-…`, `category-comparison-…`.

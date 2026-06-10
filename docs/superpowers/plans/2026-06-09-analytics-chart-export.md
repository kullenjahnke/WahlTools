# Analytics Chart-Export Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Export PNG" button to the Analytics page (Retailer mode) that downloads a stylized, theme-matched image of the selected product's price chart + retailer metrics, with the product image, title, range pill, and a "Powered by WahlTools" mark.

**Architecture:** A dedicated off-screen `ChartExportCard` component is composed from the real themed components (a real Recharts `LineChart` at a fixed size with animation disabled, real `RETAILER_COLORS`, real CSS design tokens). On export, it is mounted off-screen, rasterized to PNG with `html-to-image`, and downloaded. Because it uses the live themed DOM, the export automatically matches the current light/dark theme. Layout = "Option B v3" from the design spec (landscape: product+metrics left, chart right, footer mark).

**Tech Stack:** Next.js 15 / React 19, Recharts, `html-to-image` (new dep), date-fns, Tailwind + CSS design tokens.

**Verification note:** This repo has **no test runner**. Each task is verified with `pnpm lint` + `pnpm build`. The local browser preview cannot exercise this feature (placeholder Supabase creds → no products/auth locally), so end-to-end smoke (pick a product → Export → inspect PNG, light + dark) must be done in an environment with real data. Tasks below are written so each compiles and lints independently.

**Design spec:** `docs/superpowers/specs/2026-06-09-prices-analytics-track-design.md` → "Feature 2".

---

## File Structure

- **Create** `src/lib/analytics/export-chart.ts` — pure helpers: `slugify`, `imageToDataUrl`, `exportNodeToPng`. No React.
- **Create** `src/components/analytics/chart-export-card.tsx` — the off-screen export card (presentational, `forwardRef`). Owns the Option B v3 layout + a fixed-size Recharts chart.
- **Modify** `src/app/(dashboard)/dashboard/analytics/page.tsx` — extend the products query to include `product_images` so the card can show the product image.
- **Modify** `src/components/analytics/product-analytics.tsx` — add the Export button (Retailer mode only), the off-screen card mount, and the capture/download wiring.
- **Modify** `package.json` / lockfile — add `html-to-image`.

---

## Task 1: Add the `html-to-image` dependency

**Files:**
- Modify: `package.json` (+ `pnpm-lock.yaml` via install)

- [ ] **Step 1: Install**

Run: `pnpm add html-to-image`
Expected: `package.json` dependencies gains `"html-to-image": "^1.x"`, lockfile updates.

- [ ] **Step 2: Verify build still works**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(analytics): add html-to-image for chart export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Export helper module

A small, framework-free module: slugify a filename, convert a (possibly cross-origin) image URL to a data URL so it can be inlined, and rasterize a DOM node to a downloaded PNG.

**Files:**
- Create: `src/lib/analytics/export-chart.ts`

- [ ] **Step 1: Write the module**

```typescript
// src/lib/analytics/export-chart.ts
import { toPng } from "html-to-image"

/** Filename-safe slug: lowercase, non-alphanumerics → single dashes, trimmed. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Fetch an image URL and return a data URL, so html-to-image can inline it
 * without tripping cross-origin canvas tainting. Returns null on any failure
 * (caller falls back to a placeholder).
 */
export async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Rasterize a DOM node to a PNG and trigger a download.
 * pixelRatio 2 → crisp output; cacheBust avoids stale inlined resources.
 */
export async function exportNodeToPng(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
  const link = document.createElement("a")
  link.download = filename
  link.href = dataUrl
  link.click()
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: no errors (module is unused so far, but must type-check).

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/export-chart.ts
git commit -m "feat(analytics): export-chart helpers (slugify, imageToDataUrl, exportNodeToPng)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `ChartExportCard` component

Presentational, `forwardRef` so the parent can capture it. Fixed width (760px). Layout = Option B v3: left column = product image + title + brand + metrics table (Retailer / Avg / WoW); right column = "Prices" + range pill + fixed-size chart; footer = "Generated …" + "Powered by WahlTools". Uses `useChartTheme()` for the chart's grid/axis colors (matches the live chart) and CSS tokens for everything else (so it inherits light/dark).

**Files:**
- Create: `src/components/analytics/chart-export-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { forwardRef } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { format } from "date-fns"
import { Package } from "lucide-react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { cn } from "@/lib/utils"

export const EXPORT_CARD_WIDTH = 760

export interface ExportSeries {
  key: string
  label: string
  color: string
}

export interface ExportMetric {
  key: string
  label: string
  color: string
  avg: number | null
  wowChange: number | null
}

export interface ChartExportCardProps {
  productName: string
  brandName: string | null
  /** Pre-inlined data URL, or null to show a placeholder icon. */
  imageDataUrl: string | null
  /** Short range label for the pill, e.g. "90 days". */
  rangeLabel: string
  /** Footer line, e.g. "Generated Jun 9, 2026". */
  generatedLabel: string
  series: ExportSeries[]
  metrics: ExportMetric[]
  chartData: Array<Record<string, string | number>>
}

export const ChartExportCard = forwardRef<HTMLDivElement, ChartExportCardProps>(
  function ChartExportCard(
    { productName, brandName, imageDataUrl, rangeLabel, generatedLabel, series, metrics, chartData },
    ref
  ) {
    const chart = useChartTheme()

    return (
      <div
        ref={ref}
        style={{ width: EXPORT_CARD_WIDTH }}
        className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
      >
        <div className="flex">
          {/* Left: product + metrics */}
          <div className="w-[37%] border-r border-border p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                  {productName}
                </div>
                {brandName && (
                  <div className="text-xs text-muted-foreground">{brandName}</div>
                )}
              </div>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="border-b border-border py-1 pr-2 text-left font-medium">Retailer</th>
                  <th className="border-b border-border px-2 py-1 text-right font-medium">Avg</th>
                  <th className="border-b border-border py-1 pl-2 text-right font-medium">WoW</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.key}>
                    <td className="border-b border-border/60 py-1.5 pr-2">
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="align-middle">{m.label}</span>
                    </td>
                    <td className="border-b border-border/60 px-2 py-1.5 text-right tabular-nums">
                      {m.avg != null ? `$${m.avg.toFixed(2)}` : "—"}
                    </td>
                    <td
                      className={cn(
                        "border-b border-border/60 py-1.5 pl-2 text-right tabular-nums",
                        m.wowChange == null
                          ? "text-muted-foreground"
                          : m.wowChange < -0.1
                            ? "text-emerald-600 dark:text-emerald-400"
                            : m.wowChange > 0.1
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                      )}
                    >
                      {m.wowChange != null
                        ? `${m.wowChange > 0 ? "+" : ""}${m.wowChange.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: chart */}
          <div className="flex-1 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold">Prices</span>
              <span className="rounded-full bg-[hsl(var(--brand-muted))] px-2.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand))]">
                {rangeLabel}
              </span>
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => format(new Date(d), "MMM d")}
                    stroke={chart.axis}
                    tick={{ fill: chart.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chart.grid }}
                    minTickGap={32}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    stroke={chart.axis}
                    tick={{ fill: chart.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: chart.grid }}
                    width={56}
                    domain={["auto", "auto"]}
                  />
                  {series.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
          <span>{generatedLabel}</span>
          <span className="flex items-center gap-1.5 font-semibold text-[hsl(var(--brand))]">
            <span className="inline-block h-3 w-3 rounded-[3px] bg-[hsl(var(--brand))]" />
            Powered by WahlTools
          </span>
        </div>
      </div>
    )
  }
)
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: no errors. (The `@next/next/no-img-element` disable comment is required because we intentionally use a raw `<img>` with a data URL — `next/image` can't rasterize through html-to-image.)

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/chart-export-card.tsx
git commit -m "feat(analytics): off-screen ChartExportCard (Option B layout)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Provide the product image to Analytics

The Analytics page query currently selects products with `prices` but no images. Add `product_images` so the export card can show the product image. Mirror the pattern already used in the Price History page (`main` image, else first).

**Files:**
- Modify: `src/app/(dashboard)/dashboard/analytics/page.tsx`

- [ ] **Step 1: Extend the query + map an `imageUrl`**

Replace the products select and the `return` in `src/app/(dashboard)/dashboard/analytics/page.tsx` so the query includes images and each product gets an `imageUrl`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ProductAnalytics } from "@/components/analytics/product-analytics"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Analytics" }

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        *,
        prices (
          id,
          retailer,
          price,
          timestamp,
          status,
          is_promotion,
          promotion_notes
        ),
        product_images ( url, main )
      `)
      .order('name'),
    supabase.from('product_categories').select('id, name').order('name'),
  ])

  const withImages = (products || []).map((product) => {
    const images = (product.product_images || []) as { url: string; main: boolean }[]
    const imageUrl = (images.find((im) => im.main) || images[0])?.url ?? null
    return { ...product, imageUrl }
  })

  return (
    <PageContainer>
      <PageHeader title="Analytics" />
      <ProductAnalytics products={withImages} categories={categories || []} />
    </PageContainer>
  )
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: a TypeScript error in `product-analytics.tsx` is acceptable ONLY if introduced — but it isn't yet, because `ProductWithPrices` uses `Product & { prices?: Price[] }` (extra `imageUrl`/`product_images` keys are structurally allowed on the object literal we pass). If the build flags the extra prop, it is fixed in Task 5 where the type is extended. Prefer to do Step 1 of Task 5 immediately if the build complains.

> Implementation note for the worker: passing an object with extra fields to a component typed with a wider `Product &` intersection compiles fine in practice here; the `imageUrl` is *read* in Task 5 after the type is widened. If `pnpm build` errors on the extra key, proceed to Task 5 Step 1 (type widening) before committing, then commit Tasks 4+5 together.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/analytics/page.tsx"
git commit -m "feat(analytics): load product images for chart export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire the Export button + capture into `ProductAnalytics`

Add an "Export PNG" button to the chart card header, shown only in Retailer mode with data. On click: pre-inline the product image, mount the `ChartExportCard` off-screen with the current `visibleSeries` / `metrics` / `chartData`, wait for paint, rasterize, download, unmount.

**Files:**
- Modify: `src/components/analytics/product-analytics.tsx`

- [ ] **Step 1: Widen the product type and add imports**

At the top of `product-analytics.tsx`, update the type alias and imports.

Change:
```tsx
type ProductWithPrices = Product & { prices?: Price[] }
```
to:
```tsx
type ProductWithPrices = Product & {
  prices?: Price[]
  imageUrl?: string | null
}
```

Add these imports (merge with existing import groups):
```tsx
import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ChartExportCard,
  type ChartExportCardProps,
} from "@/components/analytics/chart-export-card"
import { slugify, imageToDataUrl, exportNodeToPng } from "@/lib/analytics/export-chart"
```
(Remove the old `import { useMemo, useState } from "react"` line — it is replaced by the wider import above. Keep the existing `BarChart3, Package, Plus, Store, Tags, TrendingDown, TrendingUp, X` lucide import and just ensure `Download` is available; if simpler, add `Download` to that existing lucide-react import instead of a second import line.)

- [ ] **Step 2: Add export state, a short range label, and the handler**

Inside the `ProductAnalytics` component, after the existing `const metrics = useMemo(...)` line, add:

```tsx
  // --- Chart export ---------------------------------------------------------
  const exportRef = useRef<HTMLDivElement>(null)
  const [exportData, setExportData] = useState<ChartExportCardProps | null>(null)

  // Short pill label derived from the selected time range (e.g. "90 days").
  const rangeLabel = useMemo(() => {
    const full = TIME_RANGES.find((r) => r.value === timeRange)?.label ?? ""
    return full.replace(/^Last\s+/i, "") // "Last 90 days" -> "90 days"
  }, [timeRange])

  const handleExport = useCallback(async () => {
    if (mode !== "retailer" || !selectedProduct) return
    const imageDataUrl = selectedProduct.imageUrl
      ? await imageToDataUrl(selectedProduct.imageUrl)
      : null
    setExportData({
      productName: selectedProduct.name,
      brandName:
        selectedProduct.brand_type === "wahlburgers"
          ? "Wahlburgers"
          : selectedProduct.brand_name || null,
      imageDataUrl,
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
    })
  }, [mode, selectedProduct, rangeLabel, visibleSeries, metrics, chartData])

  // Once the off-screen card is mounted and painted, rasterize + download it.
  useEffect(() => {
    if (!exportData) return
    let cancelled = false
    const run = async () => {
      // Two RAFs so Recharts (animation disabled) has committed its SVG.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
      if (cancelled || !exportRef.current) return
      try {
        await exportNodeToPng(
          exportRef.current,
          `${slugify(exportData.productName)}-prices-${slugify(exportData.rangeLabel)}.png`
        )
      } catch (err) {
        console.error("Chart export failed:", err)
      } finally {
        if (!cancelled) setExportData(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [exportData])
```

- [ ] **Step 3: Add the Export button to the chart card header**

Find the chart card header (the `CardHeader` containing `<CardTitle className="text-base">Price over time</CardTitle>`). Replace that `CardHeader` block with one that adds the button on the right, shown only in Retailer mode:

```tsx
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Price over time</CardTitle>
              {mode === "retailer" && chartData.length > 0 && (
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
            </CardHeader>
```

- [ ] **Step 4: Mount the off-screen export card**

Immediately before the final closing `</div>` of the component's returned tree (the outer `<div className="space-y-6">`), add the hidden card:

```tsx
      {exportData && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}
        >
          <ChartExportCard ref={exportRef} {...exportData} />
        </div>
      )}
```

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: no errors. Confirm there is exactly one `react` import line and one `lucide-react` import line (no duplicate symbols), and that `Download` resolves.

- [ ] **Step 6: Commit**

```bash
git add src/components/analytics/product-analytics.tsx
git commit -m "feat(analytics): Export PNG button with off-screen chart capture

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Manual verification + polish pass

No automated tests exist; this task is a deliberate review + (where possible) live smoke.

- [ ] **Step 1: Static review against the spec**

Confirm: button appears only in Retailer mode with data; export honors current settings (selected product, time range via `rangeLabel`, toggled-off retailers via `visibleSeries`/`metrics`); filename is `{product}-prices-{range}.png`; footer shows the brand mark; card uses tokens (light/dark inherited).

- [ ] **Step 2: Live smoke (in an environment with real Supabase data)**

In a real/staging environment: Analytics → Retailer mode → pick a product with multi-retailer history → click **Export PNG**. Verify the downloaded PNG matches Option B v3, has the product image + title + metrics + chart + "Powered by WahlTools", and is correct in **both** light and dark mode (toggle theme, re-export). If the product image is missing in the PNG, check the browser console for a CORS error on the Supabase image — if so, confirm `imageToDataUrl` is being awaited (it should pre-inline); as a fallback the card shows the Package icon, which is acceptable.

- [ ] **Step 3: Known-risk check — fonts/CORS**

If `html-to-image` logs font-fetch CORS warnings or the text renders in a fallback font, add `{ skipFonts: true }` to the `toPng` options in `exportNodeToPng` (Inter Tight is self-hosted via next/font, so this is usually unnecessary). Only apply if observed.

- [ ] **Step 4: Final lint + build**

Run: `pnpm lint && pnpm build`
Expected: clean. No commit needed unless Step 3's fallback was applied.

---

## Self-Review (done at authoring time)

- **Spec coverage:** Option B v3 layout (Task 3) ✓; product image + title (Tasks 3–5) ✓; chart with current settings (Task 5 passes `visibleSeries`/`chartData`/`rangeLabel`) ✓; retailer metrics (Task 3 table, Task 5 mapping) ✓; "Powered by WahlTools" (Task 3 footer) ✓; PNG output + filename (Task 2 + Task 5) ✓; Retailer-mode-only (Task 5 Step 3) ✓; theme-matched (tokens + `useChartTheme`) ✓; CORS image risk (Task 2 `imageToDataUrl`, Task 6 Step 2) ✓; `html-to-image` dep (Task 1) ✓.
- **Type consistency:** `ChartExportCardProps`, `ExportSeries`, `ExportMetric` defined in Task 3 and consumed identically in Task 5; `EXPORT_CARD_WIDTH` exported/used; `imageUrl` added to `ProductWithPrices` (Task 5 Step 1) and read in Task 5 Step 2; page passes `imageUrl` (Task 4).
- **Placeholders:** none — all steps contain full code/commands.

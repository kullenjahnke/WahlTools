# Phase 3 — Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Redesign the export dialog and add a styled, per-retailer **Excel matrix** export (brand-colored headers, weeks × products) via ExcelJS, keeping the existing flat CSV.

**Architecture:** ExcelJS is dynamically imported in the browser only when exporting (keeps it out of the main bundle). A pure `buildPriceMatrix` helper turns prices into per-retailer week×product grids; an `exportWorkbook` function styles them with ExcelJS. The modal gains a format toggle, date presets, Brands filter, contextual Reset, and CSV-only Columns.

**Tech Stack:** ExcelJS (new), papaparse (existing CSV), date-fns, shared `Chip`/`Dialog`.

---

## File structure

- Add dep: `exceljs`.
- Create: `src/lib/export/price-matrix.ts` — `weekKey`, `buildPriceMatrix` (pure).
- Create: `src/lib/export/excel.ts` — `exportWorkbook` (ExcelJS, brand colors, freeze, $ format).
- Modify: `src/components/prices/export-modal.tsx` — redesigned UI + format branching.

---

### Task 1: Add ExcelJS

- [ ] **Step 1: Install**

Run: `pnpm add exceljs`
Expected: `exceljs` in `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add exceljs for styled xlsx export

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `price-matrix.ts` — week buckets + matrix builder (pure)

**Files:**
- Create: `src/lib/export/price-matrix.ts`

- [ ] **Step 1: Create the file**

```ts
import type { Price, Product } from "@/types/database"

/** Monday-based week label "YYYY-MM-DD/YYYY-MM-DD" (Mon..Sun) for a date. */
export function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = (date.getUTCDay() + 6) % 7 // Mon=0
  const mon = new Date(date); mon.setUTCDate(date.getUTCDate() - day)
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return `${fmt(mon)}/${fmt(sun)}`
}

export interface MatrixProduct { id: string; name: string; brandName: string | null }
export interface RetailerMatrix {
  retailer: string
  products: MatrixProduct[]       // column order
  weeks: string[]                 // row order, oldest-first
  /** value[weekKey][productId] = price (undefined = blank) */
  value: Record<string, Record<string, number>>
}

/**
 * Build one matrix per retailer. `products` must already be filtered by the
 * selected brands/categories; `inRange` filters prices by date.
 */
export function buildPriceMatrix(args: {
  retailers: string[]
  products: (Product & { prices?: Price[] })[]
  productBrand: (p: Product) => string | null
  inRange: (ts: string) => boolean
}): RetailerMatrix[] {
  const { retailers, products, productBrand, inRange } = args
  return retailers.map((retailer) => {
    const weeksSet = new Set<string>()
    const value: Record<string, Record<string, number>> = {}
    const colProducts: MatrixProduct[] = []

    for (const product of products) {
      const rows = (product.prices || []).filter(
        (pr) => pr.retailer === retailer && pr.price > 0 && inRange(pr.timestamp)
      )
      if (rows.length === 0) continue
      colProducts.push({ id: product.id, name: product.name, brandName: productBrand(product) })
      for (const pr of rows) {
        const wk = weekKey(new Date(pr.timestamp))
        weeksSet.add(wk)
        ;(value[wk] ||= {})[product.id] = pr.price // last write per week wins
      }
    }

    const weeks = [...weeksSet].sort() // oldest-first (ISO strings sort lexically)
    return { retailer, products: colProducts, weeks, value }
  }).filter((m) => m.products.length > 0)
}
```

- [ ] **Step 2: Worked example (verify by reading)**

Two Acme prices for product X in the same Mon–Sun week → one row, latest price wins. A product with no Acme price in range → omitted from Acme's columns.

- [ ] **Step 3: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export/price-matrix.ts
git commit -m "feat(export): pure per-retailer price-matrix builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `excel.ts` — ExcelJS workbook with brand colors

**Files:**
- Create: `src/lib/export/excel.ts`

- [ ] **Step 1: Create the file**

```ts
import type { RetailerMatrix } from "./price-matrix"

const BRAND_ARGB: Record<string, string> = {
  "Wahlburgers": "FF44B549",
  "Catelli": "FF2563EB",
  "Grillo's": "FFF59E0B",
  "Schweid & Sons": "FFE11D48",
}
const DEFAULT_ARGB = "FF9CA3AF"

export async function exportWorkbook(matrices: RetailerMatrix[], filename: string) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()

  for (const m of matrices) {
    const ws = wb.addWorksheet(m.retailer.slice(0, 31)) // Excel 31-char sheet-name limit
    // header row: "week" + product names
    const header = ws.addRow(["week", ...m.products.map((p) => p.name)])
    header.font = { bold: true }
    header.eachCell((cell, col) => {
      if (col === 1) return
      const brand = m.products[col - 2]?.brandName
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: (brand && BRAND_ARGB[brand]) || DEFAULT_ARGB } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { horizontal: "center" }
    })
    // data rows
    for (const wk of m.weeks) {
      const row = ws.addRow([wk, ...m.products.map((p) => m.value[wk]?.[p.id] ?? null)])
      row.eachCell((cell, col) => {
        if (col > 1 && typeof cell.value === "number") cell.numFmt = "$#,##0.00"
      })
    }
    // blank for missing already handled (null cells render empty)
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }] // freeze row 1 + col A
    ws.getColumn(1).width = 22
    for (let c = 2; c <= m.products.length + 1; c++) {
      const len = Math.max(8, (m.products[c - 2]?.name.length ?? 8) + 2)
      ws.getColumn(c).width = Math.min(len, 28)
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Verify build** — `pnpm lint && pnpm build` (dynamic import keeps exceljs out of the main bundle).

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/excel.ts
git commit -m "feat(export): ExcelJS workbook with brand-colored matrix sheets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Redesign the modal

**Files:**
- Modify: `src/components/prices/export-modal.tsx`

- [ ] **Step 1: Add format + brand state + touched tracking**

```ts
import { BRANDS, productMatchesBrand } from "@/lib/config/brands"
import { orderRetailers } from "@/lib/config/retailers"
import { buildPriceMatrix } from "@/lib/export/price-matrix"
import { exportWorkbook } from "@/lib/export/excel"

const [fmt, setFmt] = useState<"xlsx" | "csv">("xlsx")
const [preset, setPreset] = useState<"4w" | "q" | "all" | "custom">("4w")
const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set(BRANDS))
const [touched, setTouched] = useState<Set<"retailers" | "brands" | "categories" | "columns">>(new Set())
```

- [ ] **Step 2: Render the new sections** — Format segmented toggle; Date range presets + From/To; Retailers chips (brand dots); **Brands chips** (square swatches via `BRAND_ARGB`-equivalent hex); Categories chips; **Columns chips only when `fmt === "csv"`**. Each filter section shows a **`↺ Reset`** (lucide `RotateCcw`) in its header **only when** its key is in `touched`; clicking restores that section to "all" and removes it from `touched`. Mark a section touched on any chip toggle.

- [ ] **Step 3: Date preset → range** helper

```ts
const range = useMemo(() => {
  const end = new Date(); let start: Date | null = null
  if (preset === "4w") start = new Date(Date.now() - 28 * 864e5)
  else if (preset === "q") start = new Date(Date.now() - 90 * 864e5)
  else if (preset === "all") start = null
  else { start = startDate ? new Date(startDate + "T00:00:00") : null }
  const e = preset === "custom" && endDate ? new Date(endDate + "T23:59:59") : end
  return { start, end: e }
}, [preset, startDate, endDate])
const inRange = (ts: string) => { const t = new Date(ts); if (range.start && t < range.start) return false; return t <= range.end }
```

- [ ] **Step 4: Excel export handler** (CSV path stays as-is)

```ts
const handleExport = async () => {
  if (fmt === "csv") { /* existing Papa.unparse(rows) download */ return }
  const retailers = orderRetailers([...selectedRetailers])
  const filtered = products.filter(p =>
    selectedCategories.has(p.category_id) &&
    [...selectedBrands].some(b => productMatchesBrand(p, b))
  )
  const productBrand = (p: typeof products[number]) =>
    [...selectedBrands].find(b => productMatchesBrand(p, b)) || p.brand_name || null
  const matrices = buildPriceMatrix({ retailers, products: filtered, productBrand, inRange })
  if (matrices.length === 0) return
  await exportWorkbook(matrices, `price-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`)
  setOpen(false)
}
```

- [ ] **Step 5: Scope summary + button label** switch by `fmt` (e.g. `{matrices.length} sheets` vs `{rows.length} rows`; "Export Excel" vs "Download CSV").

- [ ] **Step 6: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 7: Commit**

```bash
git add src/components/prices/export-modal.tsx
git commit -m "feat(export): redesigned modal with format toggle, brands, presets, reset

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Phase exit

- [ ] `pnpm lint` clean, `pnpm build` succeeds.
- [ ] Manually export an Excel file and open it: confirm per-retailer sheets, brand-colored headers, blank missing cells, frozen row1+colA, `$` format; confirm CSV still downloads.
- [ ] Push; update draft PR.
- [ ] **Owner reviews the Vercel preview (and a downloaded .xlsx) and approves** before Phase 4.

## Self-review notes
- Spec Phase 3 covered: ExcelJS added (T1), matrix per retailer (T2), brand colors + freeze + $ format + blank cells (T3), modal redesign incl. Brands filter + contextual Reset + CSV-only Columns + presets (T4), CSV preserved (T4).
- No charts (explicitly omitted), matching the decision.
- `buildPriceMatrix`/`exportWorkbook`/`RetailerMatrix` names consistent across T2–T4.

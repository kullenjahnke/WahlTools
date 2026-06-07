"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RETAILERS, RETAILER_COLORS, orderRetailers } from "@/lib/config/retailers"
import { BRANDS, BRAND_HEX, productMatchesBrand } from "@/lib/config/brands"
import { buildPriceMatrix } from "@/lib/export/price-matrix"
import { exportWorkbook } from "@/lib/export/excel"
import { Product, Price } from "@/types/database"
import { cn } from "@/lib/utils"
import { Download, FileSpreadsheet, FileText, RotateCcw } from "lucide-react"
import { format } from "date-fns"
import Papa from "papaparse"

type ProductWithPrices = Product & {
  prices?: Price[]
  product_categories?: { id: string; name: string }
}

interface ExportModalProps {
  products: ProductWithPrices[]
  categories: { id: string; name: string }[]
}

const ALL_COLUMNS = [
  { key: "timestamp", label: "Timestamp" },
  { key: "product_name", label: "Product Name" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "retailer", label: "Retailer" },
  { key: "price", label: "Price" },
  { key: "notes", label: "Notes" },
] as const

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"]

const DEFAULT_COLUMNS: ColumnKey[] = [
  "timestamp",
  "product_name",
  "brand",
  "category",
  "retailer",
  "price",
  "notes",
]

const MS_PER_DAY = 86_400_000

type FilterSection = "retailers" | "brands" | "categories" | "columns"
type DatePreset = "4w" | "q" | "all" | "custom"

export function ExportModal({ products, categories }: ExportModalProps) {
  const [open, setOpen] = useState(false)

  // Format
  const [fmt, setFmt] = useState<"xlsx" | "csv">("xlsx")

  // Date range
  const [preset, setPreset] = useState<DatePreset>("4w")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Filters
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(
    new Set(RETAILERS as readonly string[])
  )
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    new Set(BRANDS as readonly string[])
  )
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  )
  const [selectedColumns, setSelectedColumns] =
    useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS))

  // Track which filter sections have been changed (for contextual Reset)
  const [touched, setTouched] = useState<Set<FilterSection>>(new Set())

  const markTouched = (section: FilterSection) =>
    setTouched((prev) => new Set([...prev, section]))

  const resetSection = (section: FilterSection) => {
    if (section === "retailers") setSelectedRetailers(new Set(RETAILERS as readonly string[]))
    if (section === "brands") setSelectedBrands(new Set(BRANDS as readonly string[]))
    if (section === "categories") setSelectedCategories(new Set(categories.map((c) => c.id)))
    if (section === "columns") setSelectedColumns(new Set(DEFAULT_COLUMNS))
    setTouched((prev) => {
      const next = new Set(prev)
      next.delete(section)
      return next
    })
  }

  // Toggle helpers
  const toggleRetailer = (retailer: string) => {
    markTouched("retailers")
    setSelectedRetailers((prev) => {
      const next = new Set(prev)
      if (next.has(retailer)) next.delete(retailer)
      else next.add(retailer)
      return next
    })
  }

  const toggleBrand = (brand: string) => {
    markTouched("brands")
    setSelectedBrands((prev) => {
      const next = new Set(prev)
      if (next.has(brand)) next.delete(brand)
      else next.add(brand)
      return next
    })
  }

  const toggleCategory = (catId: string) => {
    markTouched("categories")
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const toggleColumn = (col: ColumnKey) => {
    markTouched("columns")
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  // Category name map
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  // Date range derived from preset
  const range = useMemo(() => {
    const end = new Date()
    let start: Date | null = null
    if (preset === "4w") start = new Date(Date.now() - 28 * MS_PER_DAY)
    else if (preset === "q") start = new Date(Date.now() - 90 * MS_PER_DAY)
    else if (preset === "all") start = null
    else { start = startDate ? new Date(startDate + "T00:00:00") : null }
    const e = preset === "custom" && endDate ? new Date(endDate + "T23:59:59") : end
    return { start, end: e }
  }, [preset, startDate, endDate])

  const inRange = useCallback(
    (ts: string) => {
      const t = new Date(ts)
      if (range.start && t < range.start) return false
      return t <= range.end
    },
    [range]
  )

  // Products filtered by brand + category
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          selectedCategories.has(p.category_id) &&
          [...selectedBrands].some((b) => productMatchesBrand(p, b))
      ),
    [products, selectedBrands, selectedCategories]
  )

  // CSV rows (existing logic, preserved exactly)
  const { rows, filteredCount } = useMemo(() => {
    const rows: Record<string, string | number>[] = []

    for (const product of filteredProducts) {
      for (const price of product.prices || []) {
        // Retailer filter
        if (!selectedRetailers.has(price.retailer)) continue

        // Date filter
        if (!inRange(price.timestamp)) continue

        const ts = new Date(price.timestamp)
        const row: Record<string, string | number> = {}

        if (selectedColumns.has("timestamp")) {
          row.timestamp = format(ts, "yyyy-MM-dd'T'HH:mm:ss")
        }
        if (selectedColumns.has("product_name")) {
          row.product_name = product.name
        }
        if (selectedColumns.has("brand")) {
          row.brand = product.brand_name || ""
        }
        if (selectedColumns.has("category")) {
          row.category = categoryMap.get(product.category_id) || ""
        }
        if (selectedColumns.has("retailer")) {
          row.retailer = price.retailer
        }
        if (selectedColumns.has("price")) {
          row.price = price.price
        }
        if (selectedColumns.has("notes")) {
          row.notes = price.promotion_notes || ""
        }

        rows.push(row)
      }
    }

    // Sort by timestamp descending
    rows.sort((a, b) => {
      const ta = (a.timestamp as string) || ""
      const tb = (b.timestamp as string) || ""
      return tb.localeCompare(ta)
    })

    return { rows, filteredCount: rows.length }
  }, [
    filteredProducts,
    selectedRetailers,
    selectedColumns,
    categoryMap,
    inRange,
  ])

  // Excel matrix stats (for scope summary)
  const xlsxMatrices = useMemo(() => {
    if (fmt !== "xlsx") return []
    const retailers = orderRetailers([...selectedRetailers])
    return buildPriceMatrix({
      retailers,
      products: filteredProducts,
      productBrand: (p) =>
        ([...selectedBrands].find((b) => productMatchesBrand(p, b)) ?? p.brand_name ?? null),
      inRange,
    })
  }, [fmt, filteredProducts, selectedRetailers, selectedBrands, inRange])

  const xlsxWeeksCount = useMemo(() => {
    const all = new Set<string>()
    for (const m of xlsxMatrices) m.weeks.forEach((w) => all.add(w))
    return all.size
  }, [xlsxMatrices])

  const xlsxProductCount = useMemo(() => {
    const all = new Set<string>()
    for (const m of xlsxMatrices) m.products.forEach((p) => all.add(p.id))
    return all.size
  }, [xlsxMatrices])

  const handleExport = async () => {
    if (fmt === "csv") {
      // Existing CSV path — unchanged
      if (rows.length === 0 || selectedColumns.size === 0) return
      const csv = Papa.unparse(rows)
      const blob = new Blob(["﻿" + csv], {
        type: "text/csv;charset=utf-8;",
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `price-export-${format(new Date(), "yyyy-MM-dd")}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      setOpen(false)
      return
    }

    // Excel export
    if (xlsxMatrices.length === 0) return
    await exportWorkbook(xlsxMatrices, `price-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`)
    setOpen(false)
  }

  const isExportDisabled =
    fmt === "csv"
      ? rows.length === 0 || selectedColumns.size === 0
      : xlsxMatrices.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export prices</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Format toggle */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Format
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFmt("xlsx")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  fmt === "xlsx"
                    ? "border-[--brand] bg-[--brand]/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  Excel (.xlsx)
                </div>
                <div
                  className={cn(
                    "mt-1 text-[11px]",
                    fmt === "xlsx" ? "text-[--brand]" : "text-muted-foreground"
                  )}
                >
                  Per-retailer matrix, brand-colored
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFmt("csv")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  fmt === "csv"
                    ? "border-[--brand] bg-[--brand]/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 shrink-0" />
                  CSV
                </div>
                <div
                  className={cn(
                    "mt-1 text-[11px]",
                    fmt === "csv" ? "text-[--brand]" : "text-muted-foreground"
                  )}
                >
                  Flat price log
                </div>
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Date range
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(
                [
                  { id: "4w", label: "Last 4 weeks" },
                  { id: "q", label: "This quarter" },
                  { id: "all", label: "All time" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreset(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    preset === id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input
                  type="date"
                  value={
                    preset !== "custom"
                      ? preset === "all"
                        ? ""
                        : format(range.start!, "yyyy-MM-dd")
                      : startDate
                  }
                  disabled={preset !== "custom"}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                <Input
                  type="date"
                  value={
                    preset !== "custom"
                      ? format(range.end, "yyyy-MM-dd")
                      : endDate
                  }
                  disabled={preset !== "custom"}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Retailers */}
          <div className="space-y-2">
            <SectionHeader
              label="Retailers"
              touched={touched.has("retailers")}
              onReset={() => resetSection("retailers")}
            />
            <div className="flex flex-wrap gap-1.5">
              {(RETAILERS as readonly string[]).map((retailer) => {
                const on = selectedRetailers.has(retailer)
                const color = RETAILER_COLORS[retailer] ?? "#9CA3AF"
                return (
                  <button
                    key={retailer}
                    type="button"
                    onClick={() => toggleRetailer(retailer)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-[--brand]/40 bg-[--brand]/5 text-[--brand]"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    {retailer}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Brands */}
          <div className="space-y-2">
            <SectionHeader
              label="Brands"
              touched={touched.has("brands")}
              onReset={() => resetSection("brands")}
            />
            <div className="flex flex-wrap gap-1.5">
              {(BRANDS as readonly string[]).map((brand) => {
                const on = selectedBrands.has(brand)
                const hex = BRAND_HEX[brand as keyof typeof BRAND_HEX] ?? "#9CA3AF"
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => toggleBrand(brand)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-[--brand]/40 bg-[--brand]/5 text-[--brand]"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {/* Square swatch (vs. round for retailers) */}
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-[3px]"
                      style={{ background: hex }}
                    />
                    {brand}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <SectionHeader
              label="Categories"
              touched={touched.has("categories")}
              onReset={() => resetSection("categories")}
            />
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const on = selectedCategories.has(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      on
                        ? "border-[--brand]/40 bg-[--brand]/5 text-[--brand]"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columns — CSV only */}
          {fmt === "csv" && (
            <div className="space-y-2">
              <SectionHeader
                label="Columns"
                touched={touched.has("columns")}
                onReset={() => resetSection("columns")}
              />
              <div className="flex flex-wrap gap-1.5">
                {ALL_COLUMNS.map((col) => {
                  const on = selectedColumns.has(col.key)
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleColumn(col.key)}
                      className={cn(
                        "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-[--brand]/40 bg-[--brand]/5 text-[--brand]"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      {col.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer: scope summary + export button */}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-xs text-muted-foreground">
              {fmt === "xlsx" ? (
                <>
                  <span className="font-bold tabular-nums text-foreground">
                    {xlsxMatrices.length}
                  </span>{" "}
                  sheets ·{" "}
                  <span className="font-bold tabular-nums text-foreground">
                    {xlsxWeeksCount}
                  </span>{" "}
                  weeks ·{" "}
                  <span className="font-bold tabular-nums text-foreground">
                    {xlsxProductCount}
                  </span>{" "}
                  products
                </>
              ) : (
                <>
                  <span className="font-bold tabular-nums text-foreground">
                    {filteredCount.toLocaleString()}
                  </span>{" "}
                  rows
                </>
              )}
            </span>
            <Button
              variant="brand"
              onClick={handleExport}
              disabled={isExportDisabled}
            >
              {fmt === "xlsx" ? (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Small sub-component for consistent section header + contextual Reset button
function SectionHeader({
  label,
  touched,
  onReset,
}: {
  label: string
  touched: boolean
  onReset: () => void
}) {
  return (
    <div className="flex items-center justify-between min-h-[18px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {touched && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[--brand] hover:opacity-80 transition-opacity"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      )}
    </div>
  )
}

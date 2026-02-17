"use client"

import { useState, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { RETAILERS } from "@/lib/config/retailers"
import { Product, Price } from "@/types/database"
import { Download } from "lucide-react"
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

export function ExportModal({ products, categories }: ExportModalProps) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(
    new Set(RETAILERS as readonly string[])
  )
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  )
  const [selectedColumns, setSelectedColumns] =
    useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS))

  const toggleRetailer = (retailer: string) => {
    setSelectedRetailers((prev) => {
      const next = new Set(prev)
      if (next.has(retailer)) next.delete(retailer)
      else next.add(retailer)
      return next
    })
  }

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const toggleColumn = (col: ColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  // Build the category name map
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  // Filter and prepare export data
  const { rows, filteredCount } = useMemo(() => {
    const start = startDate ? new Date(startDate + "T00:00:00") : null
    const end = endDate ? new Date(endDate + "T23:59:59") : null

    const rows: Record<string, string | number>[] = []

    for (const product of products) {
      // Category filter
      if (!selectedCategories.has(product.category_id)) continue

      for (const price of product.prices || []) {
        // Retailer filter
        if (!selectedRetailers.has(price.retailer)) continue

        // Date filter
        const ts = new Date(price.timestamp)
        if (start && ts < start) continue
        if (end && ts > end) continue

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
    products,
    startDate,
    endDate,
    selectedRetailers,
    selectedCategories,
    selectedColumns,
    categoryMap,
  ])

  const handleExport = () => {
    if (rows.length === 0) return

    const csv = Papa.unparse(rows)
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `price-export-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    setOpen(false)
  }

  const selectAllRetailers = () =>
    setSelectedRetailers(new Set(RETAILERS as readonly string[]))
  const clearAllRetailers = () => setSelectedRetailers(new Set())

  const selectAllCategories = () =>
    setSelectedCategories(new Set(categories.map((c) => c.id)))
  const clearAllCategories = () => setSelectedCategories(new Set())

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Price Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Date range */}
          <div className="space-y-2">
            <Label className="font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Retailer filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Retailers</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={selectAllRetailers}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={clearAllRetailers}
                >
                  None
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(RETAILERS as readonly string[]).map((retailer) => (
                <div key={retailer} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`exp-ret-${retailer}`}
                    checked={selectedRetailers.has(retailer)}
                    onCheckedChange={() => toggleRetailer(retailer)}
                  />
                  <Label
                    htmlFor={`exp-ret-${retailer}`}
                    className="text-sm cursor-pointer"
                  >
                    {retailer}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Categories</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={selectAllCategories}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={clearAllCategories}
                >
                  None
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`exp-cat-${cat.id}`}
                    checked={selectedCategories.has(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <Label
                    htmlFor={`exp-cat-${cat.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {cat.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Column selector */}
          <div className="space-y-2">
            <Label className="font-medium">Columns</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_COLUMNS.map((col) => (
                <div key={col.key} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`exp-col-${col.key}`}
                    checked={selectedColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  <Label
                    htmlFor={`exp-col-${col.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview count + export */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Badge variant="secondary">
              {filteredCount.toLocaleString()} rows
            </Badge>
            <Button
              onClick={handleExport}
              disabled={filteredCount === 0 || selectedColumns.size === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

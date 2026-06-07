import type { RetailerMatrix } from "./price-matrix"
import { BRAND_HEX } from "@/lib/config/brands"

// ExcelJS fills want AARRGGBB. Derive from the shared brand hex (#RRGGBB).
const toArgb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase()
const DEFAULT_ARGB = "FF9CA3AF"
const brandArgb = (brand: string | null) =>
  (brand && brand in BRAND_HEX ? toArgb(BRAND_HEX[brand as keyof typeof BRAND_HEX]) : DEFAULT_ARGB)

export async function exportWorkbook(matrices: RetailerMatrix[], filename: string) {
  const mod = await import("exceljs")
  const ExcelJS = mod.default ?? mod
  const wb = new ExcelJS.Workbook()

  for (const m of matrices) {
    const ws = wb.addWorksheet(m.retailer.slice(0, 31)) // Excel 31-char sheet-name limit
    // header row: "week" + product names
    const header = ws.addRow(["week", ...m.products.map((p) => p.name)])
    header.font = { bold: true }
    header.eachCell((cell, col) => {
      if (col === 1) return
      const brand = m.products[col - 2]?.brandName ?? null
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandArgb(brand) } }
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

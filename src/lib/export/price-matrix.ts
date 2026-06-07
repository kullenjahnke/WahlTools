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

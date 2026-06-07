// The active product brands tracked in WahlTools. Used by the Products list and
// Prices table brand filters.
export const BRANDS = ["Wahlburgers", "Catelli", "Grillo's", "Schweid & Sons"] as const

export type Brand = (typeof BRANDS)[number]

// Canonical brand colors (hex). Used for brand chips/swatches and, with an
// alpha prefix, for the styled Excel export headers.
export const BRAND_HEX: Record<Brand, string> = {
  "Wahlburgers": "#44B549",
  "Catelli": "#2563EB",
  "Grillo's": "#F59E0B",
  "Schweid & Sons": "#E11D48",
}

const normalizeBrand = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

// Matches a product to a brand, tolerant of punctuation/spacing differences
// (e.g. "Grillo's" vs "Grillos"). Wahlburgers also matches by brand_type.
export function productMatchesBrand(
  product: { brand_name?: string | null; brand_type?: string | null },
  brand: string
): boolean {
  if (brand === "Wahlburgers" && product.brand_type === "wahlburgers") return true
  return !!product.brand_name && normalizeBrand(product.brand_name) === normalizeBrand(brand)
}

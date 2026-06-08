"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  ExternalLink,
  Tag,
  Check,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  PackageX,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { detectPriceOutlier, type PriceHistoryPoint } from "@/lib/outlier"
import { recordRetailerPrices, type PriceStatus } from "@/app/actions/prices"
import { Chip } from "@/components/ui/chip"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimpleProductUrl {
  retailer: string
  url: string
}

interface SimpleProduct {
  id: string
  name: string
  category: string
  brandName: string | null
  urls: SimpleProductUrl[]
  lastPrice: number | null
  history: PriceHistoryPoint[]
}

interface PriceCheckFormProps {
  products: SimpleProduct[]
  retailer: string
  orderedRetailers: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceCheckForm({ products, retailer, orderedRetailers }: PriceCheckFormProps) {
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [originalPrices, setOriginalPrices] = useState<Record<string, string>>({})
  const [promos, setPromos] = useState<Record<string, boolean>>({})
  const [soldOut, setSoldOut] = useState<Record<string, boolean>>({})
  const [notAvailable, setNotAvailable] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [blockedUrls, setBlockedUrls] = useState<string[]>([])

  const router = useRouter()
  const { toast } = useToast()

  // Reference for inputs to enable keyboard navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category)))

  // ---------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------

  // Deduplicated count (a product marked soldOut AND having a price shouldn't double-count)
  const enteredIds = new Set([
    ...Object.keys(prices).filter(id => Number.isFinite(parseFloat(prices[id]))),
    ...Object.keys(soldOut).filter(id => soldOut[id]),
    ...Object.keys(notAvailable).filter(id => notAvailable[id]),
  ])
  const enteredUnique = enteredIds.size
  const total = products.length
  const progressPct = total > 0 ? Math.round((enteredUnique / total) * 100) : 0
  // Flat list of all products for cross-category keyboard nav (Enter → next field)
  const allProductIds = products.map(p => p.id)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePriceChange = (productId: string, value: string) => {
    setPrices(prev => ({ ...prev, [productId]: value }))
  }

  const handleOriginalPriceChange = (productId: string, value: string) => {
    setOriginalPrices(prev => ({ ...prev, [productId]: value }))
    if (value && prices[productId]) {
      const original = parseFloat(value)
      const regular = parseFloat(prices[productId])
      if (!isNaN(original) && !isNaN(regular) && original > regular) {
        setPromos(prev => ({ ...prev, [productId]: true }))
      }
    }
  }

  const handlePromoToggle = (productId: string, checked: boolean) => {
    setPromos(prev => ({ ...prev, [productId]: checked }))
    if (!checked) {
      setOriginalPrices(prev => ({ ...prev, [productId]: '' }))
    }
  }

  const handleSoldOutToggle = (productId: string, checked: boolean) => {
    setSoldOut(prev => ({ ...prev, [productId]: checked }))
    if (checked) {
      setPrices(prev => ({ ...prev, [productId]: '' }))
      setPromos(prev => ({ ...prev, [productId]: false }))
      setNotAvailable(prev => ({ ...prev, [productId]: false }))
    }
  }

  const handleNotAvailableToggle = (productId: string, checked: boolean) => {
    setNotAvailable(prev => ({ ...prev, [productId]: checked }))
    if (checked) {
      setPrices(prev => ({ ...prev, [productId]: '' }))
      setPromos(prev => ({ ...prev, [productId]: false }))
      setSoldOut(prev => ({ ...prev, [productId]: false }))
    }
  }

  // ---------------------------------------------------------------------------
  // Open all URLs — synchronous with blocked-popup fallback
  // ---------------------------------------------------------------------------

  const openAllUrls = (urls: string[]) => {
    setBlockedUrls([])
    const blocked: string[] = []
    for (const u of urls) {
      const w = window.open(u, "_blank", "noopener,noreferrer")
      if (!w) blocked.push(u)
    }
    setBlockedUrls(blocked)
    if (blocked.length) {
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Some pop-ups were blocked",
        description: "Use the list below to open the rest.",
        variant: "destructive",
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Outlier detection per product
  // ---------------------------------------------------------------------------

  const outlierFor = (p: SimpleProduct): { pct: number; reference: number } | null => {
    const raw = prices[p.id]
    if (!raw?.trim() || soldOut[p.id] || notAvailable[p.id]) return null
    const r = detectPriceOutlier({ retailer, newPrice: parseFloat(raw), history: p.history })
    return r ? { pct: r.pct, reference: r.reference } : null
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const ids = Array.from(new Set([
        ...Object.keys(prices).filter(id => prices[id]?.trim()),
        ...Object.keys(soldOut).filter(id => soldOut[id]),
        ...Object.keys(notAvailable).filter(id => notAvailable[id]),
      ]))

      const items = ids.map(id => {
        const status: PriceStatus = notAvailable[id]
          ? "not_carried"
          : soldOut[id]
            ? "out_of_stock"
            : "active"
        const onSale = !!promos[id]
        const orig = onSale && originalPrices[id] ? parseFloat(originalPrices[id]) : null
        const price = status === "active" ? parseFloat(prices[id]) : 0
        const disc =
          onSale && orig && price > 0
            ? Math.round(((orig - price) / orig) * 100)
            : null
        return {
          product_id: id,
          price,
          status,
          is_promotion: onSale,
          is_sold_out: status === "out_of_stock",
          original_price: orig,
          discount_percentage: disc,
        }
      }).filter(i => i.status !== "active" || Number.isFinite(i.price))

      if (items.length === 0) {
        toast({ icon: <AlertTriangle className="size-5" />, title: "No prices entered", variant: "destructive" })
        setLoading(false)
        return
      }

      await recordRetailerPrices(retailer, items)
      toast({
        icon: <CheckCircle2 className="size-5 text-brand" />,
        title: "Success",
        description: `Price check for ${retailer} completed`,
      })

      if (autoAdvance) {
        const i = orderedRetailers.indexOf(retailer)
        if (i > -1 && i < orderedRetailers.length - 1) {
          router.push(`/dashboard/prices/check?retailer=${encodeURIComponent(orderedRetailers[i + 1])}`)
        } else {
          toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: "All retailers complete!" })
          router.push("/dashboard/prices")
        }
      } else {
        router.push("/dashboard/prices")
      }
    } catch (error) {
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: get product URL for this retailer
  // ---------------------------------------------------------------------------

  const getProductUrl = (product: SimpleProduct): string | null => {
    if (!product.urls || product.urls.length === 0) return null
    return product.urls.find(u => u.retailer === retailer)?.url ?? null
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (products.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <h3 className="text-lg font-medium mb-2">No products available</h3>
        <p className="text-muted-foreground text-sm">
          Add products with retailer URLs to start recording prices.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Blocked URLs fallback panel */}
      {blockedUrls.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 p-3">
          <p className="text-xs font-medium mb-2 text-amber-800 dark:text-amber-300">
            Pop-ups blocked — open these manually:
          </p>
          <div className="flex flex-col gap-1">
            {blockedUrls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand underline truncate"
              >
                {u}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Meta row: progress bar + Entered pill */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.08)] px-2.5 py-0.5 text-xs font-medium text-brand whitespace-nowrap">
          Entered{" "}
          <span className="rounded-full border border-[hsl(var(--brand)/0.35)] bg-background px-2 py-px text-xs font-bold tabular-nums text-brand">
            {enteredUnique}/{total}
          </span>
        </span>
      </div>

      {/* Auto-advance toggle */}
      <div className="flex items-center gap-2.5 w-fit rounded-[10px] bg-muted px-3 py-[9px] text-[13px] font-medium">
        <Switch
          id="auto-advance"
          checked={autoAdvance}
          onCheckedChange={setAutoAdvance}
          className="scale-90"
        />
        <Label htmlFor="auto-advance" className="cursor-pointer text-[13px] font-medium">
          Auto-advance
        </Label>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map(cat => {
          const categoryProducts = products.filter(p => p.category === cat)
          if (categoryProducts.length === 0) return null

          const categoryUrls = categoryProducts
            .map(p => getProductUrl(p))
            .filter(Boolean) as string[]

          return (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-2">
                  {cat}
                  <span className="rounded-[6px] bg-muted px-[7px] py-px text-[11px] font-normal text-muted-foreground">
                    {categoryProducts.length}
                  </span>
                </h4>
                {categoryUrls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openAllUrls(categoryUrls)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-[10px] py-[5px] text-xs font-medium hover:bg-accent/60 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open all {categoryUrls.length} URL{categoryUrls.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Product rows */}
              <div className="space-y-2">
                {categoryProducts.map(product => {
                  const productUrl = getProductUrl(product)
                  const outlier = outlierFor(product)
                  const showCarryOver =
                    !prices[product.id]?.trim() &&
                    !soldOut[product.id] &&
                    !notAvailable[product.id] &&
                    product.lastPrice != null

                  // Global index for Enter-key nav
                  const globalIdx = allProductIds.indexOf(product.id)
                  const nextProductId = allProductIds[globalIdx + 1] ?? null

                  return (
                    <div
                      key={product.id}
                      className={[
                        "grid items-center gap-3 rounded-[10px] border bg-card px-[10px] py-[9px] transition-colors",
                        "grid-cols-[1.6fr_150px_auto_auto_auto]",
                        outlier ? "border-l-[3px] border-l-amber-400/70" : "",
                      ].join(' ')}
                    >
                      {/* Col 1: Product name + brand chip + external link */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm truncate">{product.name}</span>
                        {product.brandName && (
                          <Chip
                            label={product.brandName}
                            tone={product.brandName === "Wahlburgers" ? "brand" : "auto"}
                            colorKey={product.brandName}
                            size="sm"
                            className="shrink-0"
                          />
                        )}
                        {productUrl && (
                          <a
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Col 2: Price input (+ original price if on sale) */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={[
                              "flex items-center border rounded-lg px-[9px] py-[6px] gap-[2px] bg-card text-sm w-full",
                              !soldOut[product.id] && !notAvailable[product.id]
                                ? "border-border focus-within:border-brand focus-within:ring-[3px] focus-within:ring-[hsl(var(--brand)/0.12)]"
                                : "border-border opacity-50",
                            ].join(' ')}
                          >
                            <span className="text-muted-foreground text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="border-0 outline-0 w-full text-right tabular-nums bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={prices[product.id] || ''}
                              onChange={e => handlePriceChange(product.id, e.target.value)}
                              ref={el => { inputRefs.current[product.id] = el }}
                              disabled={soldOut[product.id] || notAvailable[product.id]}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && nextProductId) {
                                  e.preventDefault()
                                  inputRefs.current[nextProductId]?.focus()
                                }
                              }}
                            />
                          </div>

                          {/* Original price input shown when on sale */}
                          {promos[product.id] && (
                            <div className="flex items-center border border-border rounded-lg px-[9px] py-[6px] gap-[2px] bg-card text-sm w-full focus-within:border-brand focus-within:ring-[3px] focus-within:ring-[hsl(var(--brand)/0.12)]">
                              <span className="text-muted-foreground text-[11px] whitespace-nowrap">Orig $</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="border-0 outline-0 w-full text-right tabular-nums bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={originalPrices[product.id] || ''}
                                onChange={e => handleOriginalPriceChange(product.id, e.target.value)}
                                disabled={soldOut[product.id]}
                              />
                            </div>
                          )}
                        </div>

                        {/* Sub-row: outlier chip or carry-over — both span under the input */}
                        {outlier && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/70 dark:border-amber-600/40 rounded-md px-1.5 py-0.5">
                            {outlier.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.round(Math.abs(outlier.pct))}% was ${outlier.reference.toFixed(2)}
                          </span>
                        )}
                        {showCarryOver && (
                          <button
                            type="button"
                            onClick={() => handlePriceChange(product.id, product.lastPrice!.toFixed(2))}
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-1.5 py-0.5 hover:text-foreground hover:border-muted-foreground transition-colors w-fit"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Same as last week ${product.lastPrice!.toFixed(2)}
                          </button>
                        )}
                      </div>

                      {/* Col 3: Sale chip toggle */}
                      <button
                        type="button"
                        onClick={() => handlePromoToggle(product.id, !promos[product.id])}
                        disabled={soldOut[product.id] || notAvailable[product.id]}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg border px-[9px] py-[5px] text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                          promos[product.id]
                            ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                            : "border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        ].join(' ')}
                      >
                        <Tag className="h-3 w-3" />
                        Sale
                      </button>

                      {/* Col 4: Out chip toggle */}
                      <button
                        type="button"
                        onClick={() => handleSoldOutToggle(product.id, !soldOut[product.id])}
                        disabled={notAvailable[product.id]}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg border px-[9px] py-[5px] text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                          soldOut[product.id]
                            ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                            : "border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        ].join(' ')}
                      >
                        <PackageX className="h-3 w-3" />
                        Out
                      </button>

                      {/* Col 5: N/A chip toggle */}
                      <button
                        type="button"
                        onClick={() => handleNotAvailableToggle(product.id, !notAvailable[product.id])}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg border px-[9px] py-[5px] text-xs font-medium whitespace-nowrap transition-colors",
                          notAvailable[product.id]
                            ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                            : "border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        ].join(' ')}
                      >
                        <XCircle className="h-3 w-3" />
                        N/A
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Press{" "}
          <kbd className="font-mono bg-[hsl(var(--brand)/0.08)] text-brand border border-[hsl(var(--brand)/0.35)] rounded-[5px] px-[6px] py-px text-[11px] font-semibold">
            ↵
          </kbd>{" "}
          to jump to the next field
        </span>

        <Button
          onClick={handleSubmit}
          disabled={loading || enteredUnique === 0}
          className="bg-brand hover:bg-brand/90 text-white font-semibold gap-2"
        >
          <Check className="h-4 w-4" />
          {loading ? "Saving…" : "Complete Price Check"}
        </Button>
      </div>
    </div>
  )
}

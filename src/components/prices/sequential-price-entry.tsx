"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { Chip } from "@/components/ui/chip"
import { useToast } from "@/hooks/use-toast"
import { recordRetailerPrices } from "@/app/actions/prices"
import type { PriceStatus } from "@/app/actions/prices"
import type { PriceHistoryPoint } from "@/lib/outlier"
import { RETAILER_COLORS } from "@/lib/config/retailers"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeqProduct {
  id: string
  name: string
  category: string
  brandName: string | null
  imageUrl: string | null
  urls: { retailer: string; url: string }[]
  history: PriceHistoryPoint[]
  lastPriceByRetailer: Record<string, number>
}

interface Props {
  products: SeqProduct[]
  retailers: string[]
  checkStatus: Record<string, string>
}

// ─── Category glyph fallback ─────────────────────────────────────────────────

function categoryGlyph(category: string): string {
  const cat = category.toLowerCase()
  if (cat.includes("burger")) return "🍔"
  if (cat.includes("hot dog") || cat.includes("hotdog") || cat.includes("frank")) return "🌭"
  if (cat.includes("chicken")) return "🍗"
  if (cat.includes("bacon") || cat.includes("pork")) return "🥓"
  if (cat.includes("pasta") || cat.includes("noodle")) return "🍝"
  if (cat.includes("pickle")) return "🥒"
  if (cat.includes("sauce") || cat.includes("condiment")) return "🫙"
  return "🛒"
}

// ─── Hotkey kbd pill ─────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] bg-muted border border-border rounded px-[5px] py-px text-muted-foreground leading-none">
      {children}
    </kbd>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SequentialPriceEntry({ products, retailers, checkStatus }: Props) {
  const [retailer, setRetailer] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [price, setPrice] = useState("")
  const [originalPrice, setOriginalPrice] = useState("")
  const [isPromo, setIsPromo] = useState(false)
  const [isSoldOut, setIsSoldOut] = useState(false)
  const [isNotAvailable, setIsNotAvailable] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const priceInputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false) // re-entrancy guard against double-submit (e.g. Enter spam)

  // Products carrying the chosen retailer's URL
  const deck = useMemo(
    () => products.filter((p) => p.urls.some((u) => u.retailer === retailer)),
    [products, retailer]
  )

  const current = deck[index] ?? null
  const lastWeek = current ? (current.lastPriceByRetailer[retailer!] ?? null) : null
  const url = current?.urls.find((u) => u.retailer === retailer)?.url ?? null

  // Auto-focus the price input whenever the card advances
  useEffect(() => {
    if (current) priceInputRef.current?.focus()
  }, [current, index, retailer])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetCard = useCallback(() => {
    setPrice("")
    setOriginalPrice("")
    setIsPromo(false)
    setIsSoldOut(false)
    setIsNotAvailable(false)
  }, [])

  const advance = useCallback(() => {
    resetCard()
    if (index < deck.length - 1) {
      setIndex(index + 1)
    } else {
      toast({
        title: "All complete!",
        description: `Saved ${savedCount + 1} price${savedCount + 1 === 1 ? "" : "s"} for ${retailer}.`,
      })
      router.push("/dashboard/prices")
    }
  }, [index, deck.length, resetCard, savedCount, retailer, router, toast])

  const goBack = useCallback(() => {
    resetCard()
    if (index > 0) setIndex(index - 1)
  }, [index, resetCard])

  const openBeside = useCallback(() => {
    if (!url) return
    const w = Math.min(640, Math.floor(window.screen.availWidth / 2))
    const popup = window.open(
      url,
      "wahltools_beside",
      `width=${w},height=${window.screen.availHeight},left=${window.screen.availWidth - w},top=0`
    )
    if (!popup) window.open(url, "_blank", "noopener,noreferrer")
  }, [url])

  const save = useCallback(async () => {
    if (savingRef.current) return // guard against double-submit
    const parsed = parseFloat(price)
    if (!isSoldOut && !isNotAvailable && (price.trim() === "" || !Number.isFinite(parsed) || parsed <= 0)) {
      toast({
        title: "Enter a price greater than $0, Sold Out, or N/A",
        variant: "destructive",
      })
      return
    }
    savingRef.current = true
    setLoading(true)
    try {
      const status: PriceStatus = isNotAvailable
        ? "not_carried"
        : isSoldOut
        ? "out_of_stock"
        : "active"
      const orig = isPromo && originalPrice ? parseFloat(originalPrice) : null
      const value = status === "active" ? parseFloat(price) : 0
      const disc =
        isPromo && orig && value > 0
          ? Math.round(((orig - value) / orig) * 100)
          : null

      await recordRetailerPrices(retailer!, [
        {
          product_id: current!.id,
          price: value,
          status,
          is_promotion: isPromo,
          is_sold_out: status === "out_of_stock",
          original_price: orig,
          discount_percentage: disc,
        },
      ])
      setSavedCount((c) => c + 1)
      advance()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      savingRef.current = false
    }
  }, [
    price,
    isSoldOut,
    isNotAvailable,
    isPromo,
    originalPrice,
    retailer,
    current,
    advance,
    toast,
  ])

  // ── Hotkeys ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack when typing in an input other than our price field
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter") {
          e.preventDefault()
          save()
        }
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        save()
        return
      }
      const k = e.key.toLowerCase()
      if (k === "l" && lastWeek != null) {
        e.preventDefault()
        setIsSoldOut(false)
        setIsNotAvailable(false)
        setPrice(lastWeek.toFixed(2))
      } else if (k === "s") {
        e.preventDefault()
        setIsPromo((v) => !v)
      } else if (k === "o") {
        e.preventDefault()
        setIsSoldOut(true)
        setIsNotAvailable(false)
        setPrice("")
      } else if (k === "n") {
        e.preventDefault()
        setIsNotAvailable(true)
        setIsSoldOut(false)
        setPrice("")
      } else if (k === "v") {
        e.preventDefault()
        openBeside()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, lastWeek, save, openBeside])

  // ── Retailer picker ───────────────────────────────────────────────────────

  if (!retailer) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <p className="text-sm text-muted-foreground">
          Choose a retailer to start entering prices sequentially.
        </p>
        <div className="flex flex-wrap gap-2">
          {retailers.map((r) => {
            const isDone = !!checkStatus[r]
            const color = RETAILER_COLORS[r] || "#64748b"
            return (
              <button
                key={r}
                onClick={() => {
                  setRetailer(r)
                  setIndex(0)
                  resetCard()
                }}
                className={[
                  "inline-flex items-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-medium transition-colors",
                  isDone
                    ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand hover:bg-[hsl(var(--brand)/0.12)]"
                    : "border-border bg-card text-foreground hover:bg-accent/60",
                ].join(" ")}
              >
                {isDone ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand shrink-0">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                {r}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Empty deck ────────────────────────────────────────────────────────────

  if (deck.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No products with a {retailer} URL found.
          </p>
          <button
            onClick={() => setRetailer(null)}
            className="mt-4 text-sm text-brand underline underline-offset-2"
          >
            ← Back to retailer picker
          </button>
        </div>
      </div>
    )
  }

  // ── Card flow ─────────────────────────────────────────────────────────────

  const progressWidth = `${Math.round((index / deck.length) * 100)}%`
  const retailerColor = RETAILER_COLORS[retailer] || "#6b7280"

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── Progress row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Exit × */}
        <button
          aria-label="Back to retailer picker"
          onClick={() => setRetailer(null)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Retailer pill */}
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold text-white shrink-0"
          style={{ backgroundColor: retailerColor }}
        >
          {retailer}
        </span>

        {/* Brand-green progress bar */}
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-300"
            style={{ width: progressWidth }}
          />
        </div>

        {/* N / M count pill */}
        <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-bold tabular-nums">
          {index + 1} / {deck.length}
        </span>
      </div>

      {/* ── Card stack ───────────────────────────────────────────── */}
      <div className="relative mx-1.5">
        {/* Ghost card 2 (furthest back) */}
        {index + 2 < deck.length && (
          <div className="absolute inset-x-6 -top-[18px] h-14 rounded-2xl border border-border bg-card opacity-40" />
        )}
        {/* Ghost card 1 */}
        {index + 1 < deck.length && (
          <div className="absolute inset-x-3 -top-[10px] h-14 rounded-2xl border border-border bg-card opacity-70" />
        )}

        {/* Main card */}
        <div className="relative rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] p-5 space-y-4">
          {/* Product header */}
          <div className="flex gap-3.5 items-center">
            {/* Thumbnail */}
            <div className="h-14 w-14 shrink-0 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center text-2xl">
              {current.imageUrl ? (
                <Image
                  src={current.imageUrl}
                  alt={current.name}
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span role="img" aria-label={current.category}>
                  {categoryGlyph(current.category)}
                </span>
              )}
            </div>

            {/* Name + chips */}
            <div className="min-w-0">
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-1.5 truncate">
                {current.name}
              </h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {current.brandName && (
                  <Chip label={current.brandName} tone="brand" size="sm" />
                )}
                <Chip
                  label={current.category}
                  tone="auto"
                  colorKey={current.category}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Open beside */}
          <button
            onClick={openBeside}
            disabled={!url}
            className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] font-semibold hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-base leading-none">⧉</span>
            <span>Open at {retailer} beside this</span>
            <Kbd>V</Kbd>
          </button>

          {/* Last week chip */}
          {lastWeek != null && (
            <button
              onClick={() => {
                setIsSoldOut(false)
                setIsNotAvailable(false)
                setPrice(lastWeek.toFixed(2))
                priceInputRef.current?.focus()
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] px-2.5 py-1.5 text-[12px] font-semibold text-brand hover:bg-[hsl(var(--brand)/0.12)] transition-colors"
            >
              <span>↺ Last week</span>
              <span className="tabular-nums">${lastWeek.toFixed(2)}</span>
              <kbd className="font-mono text-[10px] bg-white dark:bg-background border border-[hsl(var(--brand)/0.4)] rounded px-[5px] py-px text-brand leading-none">
                L
              </kbd>
            </button>
          )}

          {/* Big price input */}
          <div
            className={[
              "flex items-center gap-1 rounded-xl border-2 px-4 py-3",
              isSoldOut || isNotAvailable
                ? "border-muted opacity-50"
                : "border-brand shadow-[0_0_0_4px_hsl(var(--brand)/0.12)]",
            ].join(" ")}
          >
            <span className="text-[22px] text-muted-foreground leading-none mr-1">$</span>
            <input
              ref={priceInputRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={isSoldOut || isNotAvailable || loading}
              className="flex-1 bg-transparent text-[26px] font-bold tabular-nums outline-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Promo original price (revealed when Sale is on) */}
          {isPromo && (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-muted-foreground">Original $</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
              </div>
              {price && originalPrice && parseFloat(originalPrice) > 0 && parseFloat(price) > 0 && (
                <Chip
                  label={`${Math.round(((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100)}% off`}
                  tone="brand"
                  size="sm"
                />
              )}
            </div>
          )}

          {/* Sale / Sold Out / N/A chips */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Sale */}
            <button
              onClick={() => setIsPromo((v) => !v)}
              disabled={isSoldOut || isNotAvailable}
              className={[
                "flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                isPromo
                  ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              <span>◷ Sale</span>
              <Kbd>S</Kbd>
            </button>

            {/* Sold Out */}
            <button
              onClick={() => {
                setIsSoldOut(true)
                setIsNotAvailable(false)
                setPrice("")
              }}
              className={[
                "flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                isSoldOut
                  ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              <span>⊘ Sold Out</span>
              <Kbd>O</Kbd>
            </button>

            {/* N/A */}
            <button
              onClick={() => {
                setIsNotAvailable(true)
                setIsSoldOut(false)
                setPrice("")
              }}
              className={[
                "flex items-center justify-center gap-1.5 rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                isNotAvailable
                  ? "border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.08)] text-brand"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/60",
              ].join(" ")}
            >
              <span>✕ N/A</span>
              <Kbd>N</Kbd>
            </button>
          </div>

          {/* Footer: ← Back + Save & Next ↵ */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={goBack}
              disabled={index === 0 || loading}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>
            <div className="flex-1" />
            <button
              onClick={save}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-brand/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Saving…" : "Save & Next"}
              {!loading && (
                <kbd className="font-mono text-[10px] bg-white/20 rounded px-[5px] py-px text-white leading-none border-0">
                  ↵
                </kbd>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hotkey hint bar ───────────────────────────────────────── */}
      <p className="text-center text-[12px] text-muted-foreground leading-loose">
        <Kbd>↵</Kbd> save &amp; next{" "}
        {lastWeek != null && (
          <>
            &nbsp; <Kbd>L</Kbd> last week{" "}
          </>
        )}
        &nbsp; <Kbd>S</Kbd> sale &nbsp; <Kbd>O</Kbd> sold out &nbsp;{" "}
        <Kbd>N</Kbd> n/a &nbsp; <Kbd>V</Kbd> view beside
      </p>
    </div>
  )
}

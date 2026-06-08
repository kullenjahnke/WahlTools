'use client'

import { useEffect, useRef, useState } from 'react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'
import { RETAILERS } from '@/lib/config/retailers'

export interface ProductOption { id: string; name: string }

export function TagPicker({
  products,
  selectedProductIds,
  onProductsChange,
  selectedRetailers,
  onRetailersChange,
}: {
  products: ProductOption[]
  selectedProductIds: string[]
  onProductsChange: (ids: string[]) => void
  selectedRetailers: string[]
  onRetailersChange: (retailers: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  function toggleProduct(id: string) {
    onProductsChange(
      selectedProductIds.includes(id)
        ? selectedProductIds.filter((x) => x !== id)
        : [...selectedProductIds, id]
    )
  }
  function toggleRetailer(r: string) {
    onRetailersChange(
      selectedRetailers.includes(r)
        ? selectedRetailers.filter((x) => x !== r)
        : [...selectedRetailers, r]
    )
  }

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? 'Unknown'

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedProductIds.map((id) => (
          <Chip
            key={id}
            tone="auto"
            colorKey={id}
            label={
              <span className="flex items-center gap-1">
                {nameOf(id)}
                <X className="size-3 cursor-pointer" onClick={() => toggleProduct(id)} />
              </span>
            }
          />
        ))}
        {selectedRetailers.map((r) => (
          <Chip
            key={r}
            tone="brand"
            label={
              <span className="flex items-center gap-1">
                {r}
                <X className="size-3 cursor-pointer" onClick={() => toggleRetailer(r)} />
              </span>
            }
          />
        ))}
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-3" /> Tag
        </Button>
      </div>

      {open && (
        <div className="rounded-lg border border-border bg-muted/30 p-2">
          <Input
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-2 h-8"
          />
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {filtered.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => toggleProduct(p.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                  selectedProductIds.includes(p.id) ? 'font-medium text-brand' : ''
                }`}
              >
                {p.name}
                {selectedProductIds.includes(p.id) && <span>✓</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No products</p>}
          </div>
          <div className="mt-2 border-t pt-2">
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase text-muted-foreground">Retailers</p>
            <div className="flex flex-wrap gap-1">
              {RETAILERS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => toggleRetailer(r)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    selectedRetailers.includes(r) ? 'border-brand bg-brand-muted text-brand' : 'border-border'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

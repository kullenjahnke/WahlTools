"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RETAILERS } from "@/lib/config/retailers"

// Retailer + product pickers for the comparison-history page; updates the URL
// search params (client-side) instead of relying on a full reload.
export function HistoryComparisonControls({
  products,
  retailer,
  productId,
}: {
  products: { id: string; label: string }[]
  retailer: string
  productId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={retailer} onValueChange={(v) => setParam("retailer", v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select retailer" />
        </SelectTrigger>
        <SelectContent>
          {RETAILERS.map((r) => (
            <SelectItem key={r} value={r}>{r}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={productId} onValueChange={(v) => setParam("product", v)}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select product" />
        </SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

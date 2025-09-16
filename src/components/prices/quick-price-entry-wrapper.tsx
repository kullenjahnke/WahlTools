"use client"

import { QuickPriceEntry } from "./quick-price-entry"
import { useRouter } from "next/navigation"

interface QuickPriceEntryWrapperProps {
  productId: string
  productName: string
  retailerUrls: {
    retailer: string
    url: string
  }[]
  currentPrices: {
    retailer: string
    price: number | null
    timestamp: string | null
  }[]
}

export function QuickPriceEntryWrapper(props: QuickPriceEntryWrapperProps) {
  const router = useRouter()

  return (
    <QuickPriceEntry
      {...props}
      onPricesUpdated={() => router.refresh()}
    />
  )
} 
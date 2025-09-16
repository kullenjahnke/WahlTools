"use client"

import { RetailerAssociations } from "./retailer-associations"

interface RetailerAssociationsWrapperProps {
  productId: string
  initialSkus: {
    retailer: string
    sku: string
  }[]
  initialUrls: {
    retailer: string
    url: string
  }[]
}

export function RetailerAssociationsWrapper({
  productId,
  initialSkus,
  initialUrls,
}: RetailerAssociationsWrapperProps) {
  return (
    <RetailerAssociations
      productId={productId}
      initialSkus={initialSkus}
      initialUrls={initialUrls}
    />
  )
}
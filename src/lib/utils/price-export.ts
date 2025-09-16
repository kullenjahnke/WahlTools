import type { Product, Price } from "@/types/database"
import { format } from "date-fns"
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

type ProductWithPrices = Product & {
  prices?: Price[]
}

export function exportPriceHistoryToCSV(
  products: ProductWithPrices[],
  selectedProductId?: string
) {
  const productsToExport = selectedProductId 
    ? products.filter(p => p.id === selectedProductId)
    : products

  const csvData = productsToExport.flatMap(product =>
    (product.prices || []).map(price => ({
      product_name: product.name,
      product_category: product.category_id,
      retailer: price.retailer,
      price: price.price,
      date: format(new Date(price.timestamp), 'yyyy-MM-dd'),
      time: format(new Date(price.timestamp), 'HH:mm:ss')
    }))
  )

  const csv = Papa.unparse(csvData)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `price-history-${selectedProductId ? 'single' : 'all'}-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
}

export function exportPriceHistoryToExcel(
  products: ProductWithPrices[],
  selectedProductId?: string
) {
  const productsToExport = selectedProductId 
    ? products.filter(p => p.id === selectedProductId)
    : products

  // Create worksheets for different views
  const byProduct = productsToExport.flatMap(product =>
    (product.prices || []).map(price => ({
      product_name: product.name,
      product_category: product.category_id,
      retailer: price.retailer,
      price: price.price,
      date: format(new Date(price.timestamp), 'yyyy-MM-dd'),
      time: format(new Date(price.timestamp), 'HH:mm:ss')
    }))
  )

  const byRetailer = productsToExport.reduce((acc, product) => {
    const latestPrices = (product.prices || []).reduce((prices, price) => {
      if (!prices[price.retailer] || 
          new Date(price.timestamp) > new Date(prices[price.retailer].timestamp)) {
        prices[price.retailer] = price
      }
      return prices
    }, {} as Record<string, Price>)

    return [
      ...acc,
      ...Object.entries(latestPrices).map(([retailer, price]) => ({
        product_name: product.name,
        product_category: product.category_id,
        retailer,
        latest_price: price.price,
        last_updated: format(new Date(price.timestamp), 'yyyy-MM-dd HH:mm:ss')
      }))
    ]
  }, [] as Array<{
    product_name: string
    product_category: string
    retailer: string
    latest_price: number
    last_updated: string
  }>)

  const wb = XLSX.utils.book_new()

  // Add full history worksheet
  const historyWS = XLSX.utils.json_to_sheet(byProduct)
  XLSX.utils.book_append_sheet(wb, historyWS, 'Price History')

  // Add latest prices worksheet
  const latestWS = XLSX.utils.json_to_sheet(byRetailer)
  XLSX.utils.book_append_sheet(wb, latestWS, 'Latest Prices')

  // Generate summary statistics
  const summary = productsToExport.map(product => {
    const prices = product.prices || []
    const latestPrices = prices.reduce((acc, price) => {
      if (!acc[price.retailer] || 
          new Date(price.timestamp) > new Date(acc[price.retailer].timestamp)) {
        acc[price.retailer] = price
      }
      return acc
    }, {} as Record<string, Price>)

    return {
      product_name: product.name,
      category: product.category_id,
      total_price_records: prices.length,
      average_price: prices.length > 0 
        ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length 
        : 0,
      retailers_tracked: Object.keys(latestPrices).length,
      last_update: prices.length > 0 
        ? format(new Date(Math.max(...prices.map(p => new Date(p.timestamp).getTime()))), 'yyyy-MM-dd HH:mm:ss')
        : 'N/A'
    }
  })

  const summaryWS = XLSX.utils.json_to_sheet(summary)
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary')

  // Save the file
  XLSX.writeFile(wb, `price-history-${selectedProductId ? 'single' : 'all'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}
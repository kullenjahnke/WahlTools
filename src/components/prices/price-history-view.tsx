"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Product, Price } from "@/types/database"
import { format } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ProductWithPrices = Product & {
  prices?: Price[]
}

interface PriceHistoryViewProps {
  products: ProductWithPrices[]
  priceLogs: Array<{
    id: string
    old_price: number
    new_price: number
    changed_at: string
    changed_by: string
    price: {
      product_id: string
      retailer: string
    }
  }>
}

export function PriceHistoryView({ products, priceLogs }: PriceHistoryViewProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>()
  const retailers = ['Meijer', 'Walmart', 'Jewel-Osco']
  const colors = {
    'Meijer': '#2563eb',
    'Walmart': '#dc2626',
    'Jewel-Osco': '#16a34a'
  }

  const selectedProductData = products.find(p => p.id === selectedProduct)

  const formatChartData = () => {
    if (!selectedProductData?.prices) return []

    const pricesByDate = selectedProductData.prices.reduce((acc, price) => {
      const date = format(new Date(price.timestamp), 'yyyy-MM-dd')
      if (!acc[date]) acc[date] = {}
      acc[date][price.retailer] = price.price
      return acc
    }, {} as Record<string, Record<string, number>>)

    return Object.entries(pricesByDate)
      .map(([date, prices]) => ({
        date,
        ...prices
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const chartData = formatChartData()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Select
              value={selectedProduct}
              onValueChange={setSelectedProduct}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Legend />
                  {retailers.map((retailer) => (
                    <Line
                      key={retailer}
                      type="monotone"
                      dataKey={retailer}
                      stroke={colors[retailer as keyof typeof colors]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Price Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Retailer</TableHead>
                <TableHead>Old Price</TableHead>
                <TableHead>New Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLogs.map((log) => {
                const product = products.find(p => p.id === log.price.product_id)
                const priceChange = ((log.new_price - log.old_price) / log.old_price) * 100
                
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {product?.name || 'Unknown Product'}
                    </TableCell>
                    <TableCell>{log.price.retailer}</TableCell>
                    <TableCell>${log.old_price.toFixed(2)}</TableCell>
                    <TableCell>${log.new_price.toFixed(2)}</TableCell>
                    <TableCell className={priceChange > 0 ? 'text-red-500' : 'text-green-500'}>
                      {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.changed_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                  </TableRow>
                )
              })}
              {priceLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No recent price changes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
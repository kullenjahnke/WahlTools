"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PricePoint {
  timestamp: string
  price: number
  retailer: string
}

interface PriceHistoryChartProps {
  data: PricePoint[]
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const formattedData = data.map(point => ({
    ...point,
    timestamp: new Date(point.timestamp).toLocaleDateString(),
    price: Number(point.price)
  }));

  // Group data by retailer
  const retailers = Array.from(new Set(data.map(point => point.retailer)));
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea']; // Different colors for different retailers

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              {retailers.map((retailer, index) => (
                <Line
                  key={retailer}
                  type="monotone"
                  dataKey="price"
                  data={formattedData.filter(d => d.retailer === retailer)}
                  name={retailer}
                  stroke={colors[index % colors.length]}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

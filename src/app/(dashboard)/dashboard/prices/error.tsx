'use client'

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function PricesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Prices error:', error)
  }, [error])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Prices</h1>

      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load prices</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            There was an error loading price data. Please try again.
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

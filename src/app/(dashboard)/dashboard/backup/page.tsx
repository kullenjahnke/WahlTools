"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClientClient } from "@/lib/supabase/client"
import { Download, Database, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BackupPage() {
  const [isExporting, setIsExporting] = useState(false)
  const [status, setStatus] = useState<string>("")
  const supabase = createClientClient()

  const exportData = async () => {
    setIsExporting(true)
    setStatus("Starting export...")

    try {
      const backup: { timestamp: string; version: string; tables: Record<string, unknown> } = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        tables: {}
      }

      // List of tables to export
      const tables = [
        'products',
        'product_categories',
        'product_urls',
        'product_images',
        'prices',
        'price_change_logs',
        'price_check_logs',
        'competitors',
        'competitor_products',
        'competitor_product_urls',
        'competitor_prices'
      ]

      // Export each table
      for (const table of tables) {
        setStatus(`Exporting ${table}...`)
        
        const { data, error } = await supabase
          .from(table)
          .select('*')
        
        if (error) {
          console.error(`Error exporting ${table}:`, error)
          backup.tables[table] = { error: error.message }
        } else {
          backup.tables[table] = data || []
        }
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wahlburgers_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      a.click()
      window.URL.revokeObjectURL(url)

      setStatus("Export complete! File downloaded.")
    } catch (error) {
      console.error('Export error:', error)
      setStatus(`Export failed: ${error}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Database Backup</h1>
        <p className="text-muted-foreground">Export all data before making major changes</p>
      </div>

      <div className="grid gap-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Before Migration:</strong> Always create a backup before making database schema changes.
            This export includes all products, prices, competitors, and related data.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Export Database</CardTitle>
            <CardDescription>
              Download a complete JSON backup of all database tables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={exportData}
                disabled={isExporting}
                size="lg"
                className="flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                {isExporting ? "Exporting..." : "Export All Data"}
              </Button>
              
              {status && (
                <p className="text-sm text-muted-foreground">{status}</p>
              )}
            </div>

            <div className="border rounded-lg p-4 bg-muted/20">
              <h3 className="font-semibold mb-2">Included Tables:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>• Products</div>
                <div>• Product Categories</div>
                <div>• Product URLs</div>
                <div>• Product Images</div>
                <div>• Prices</div>
                <div>• Price Change Logs</div>
                <div>• Competitors</div>
                <div>• Competitor Products</div>
                <div>• Competitor URLs</div>
                <div>• Competitor Prices</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supabase Dashboard Backup</CardTitle>
            <CardDescription>
              For a complete SQL backup, use the Supabase dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to your Supabase Dashboard</li>
              <li>Navigate to Settings → Database</li>
              <li>Click on &quot;Backups&quot; tab</li>
              <li>Click &quot;Create a new backup&quot;</li>
              <li>Download the backup once complete</li>
            </ol>
            
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => window.open('https://app.supabase.com', '_blank')}
            >
              <Database className="h-4 w-4 mr-2" />
              Open Supabase Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
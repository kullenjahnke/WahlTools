import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutomationDashboard } from "@/components/prices/automation-dashboard"
import { getScrapingStatus } from "@/app/actions/automated-prices"
import { AlertCircle, CheckCircle } from "lucide-react"

export default async function PriceAutomationPage() {
  const status = await getScrapingStatus()
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Price Automation</h1>
        <p className="text-muted-foreground mt-1">
          Manage automated price scraping with Firecrawl
        </p>
      </div>
      
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
          <CardDescription>System readiness for automated scraping</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status.data?.firecrawlConfigured ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Firecrawl API configured</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <span className="text-sm">Firecrawl API key check pending - Restart server after adding FIRECRAWL_API_KEY to .env.local</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            <span className="text-sm">
              {status.data?.totalProductUrls || 0} product URLs configured
            </span>
          </div>
          
          {status.data?.retailersConfigured && status.data.retailersConfigured.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Configured Retailers:</p>
              <div className="flex gap-2 flex-wrap">
                {status.data.retailersConfigured.map((retailer: string) => (
                  <span
                    key={retailer}
                    className="px-2 py-1 bg-muted rounded-md text-xs"
                  >
                    {retailer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Automation Dashboard */}
      <AutomationDashboard />
      
      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Understanding the automated price scraping process</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Select Retailer</p>
                <p className="text-sm text-muted-foreground">
                  Choose which retailer to scrape prices from
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium text-sm">Firecrawl Scrapes Pages</p>
                <p className="text-sm text-muted-foreground">
                  Firecrawl visits each product URL and extracts pricing data
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium text-sm">Process & Store Data</p>
                <p className="text-sm text-muted-foreground">
                  Prices are validated and stored in the database with tracking info
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <p className="font-medium text-sm">Review Results</p>
                <p className="text-sm text-muted-foreground">
                  Check the results and handle any products that couldn&apos;t be scraped
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Rate Limits</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Free tier: 500 pages total. Hobby tier: 3,000 pages/month.
                  Each product URL counts as 1 credit.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
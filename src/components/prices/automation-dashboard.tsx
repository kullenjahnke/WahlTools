'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { scrapeRetailerPrices, testSingleProductScrape, type AutomatedScrapeResult } from "@/app/actions/automated-prices"
import { Loader2, Play, AlertCircle, CheckCircle, XCircle, TestTube, Calendar } from "lucide-react"
import { RETAILERS } from "@/lib/config/retailers"
import { createClientClient } from "@/lib/supabase/client"

export function AutomationDashboard() {
  const [selectedRetailer, setSelectedRetailer] = useState<string>("")
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [availableProducts, setAvailableProducts] = useState<Array<{id: string, name: string}>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isRunningWeekly, setIsRunningWeekly] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [results, setResults] = useState<AutomatedScrapeResult[]>([])
  const [testResult, setTestResult] = useState<any>(null)
  const { toast } = useToast()
  const supabase = createClientClient()

  // Load products when retailer changes
  useEffect(() => {
    async function loadProducts() {
      if (!selectedRetailer) {
        setAvailableProducts([])
        setSelectedProduct("")
        return
      }

      setLoadingProducts(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            product_urls!inner (
              retailer
            )
          `)
          .eq('product_urls.retailer', selectedRetailer)
          .order('name')

        if (error) throw error
        
        setAvailableProducts(data || [])
        setSelectedProduct("") // Reset product selection
      } catch (error) {
        console.error('Error loading products:', error)
        toast({
          title: "Error loading products",
          description: "Failed to load products for this retailer",
          variant: "destructive"
        })
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [selectedRetailer, supabase, toast])

  const handleRunScraping = async () => {
    if (!selectedRetailer) {
      toast({
        title: "Select a retailer",
        description: "Please select a retailer to scrape prices from",
        variant: "destructive"
      })
      return
    }

    setIsRunning(true)
    setResults([])
    
    try {
      const response = await scrapeRetailerPrices(selectedRetailer)
      
      if (response.success) {
        setResults(response.results)
        toast({
          title: "Scraping completed",
          description: response.message,
        })
      } else {
        toast({
          title: "Scraping failed",
          description: response.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleRunWeeklyCheck = async () => {
    setIsRunningWeekly(true)
    
    try {
      const response = await fetch('/api/cron/weekly-price-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Weekly check completed",
          description: `Updated prices for HyVee and ShopRite`,
        })
        
        // Convert weekly results to display format
        if (data.results) {
          const displayResults = []
          for (const retailerResult of data.results) {
            if (retailerResult.success) {
              displayResults.push({
                productId: 'weekly-' + retailerResult.retailer,
                productName: `All ${retailerResult.retailer} Products`,
                retailer: retailerResult.retailer,
                url: '',
                success: true,
                price: undefined,
                isPromotion: false,
                promotionNotes: `${retailerResult.productsScraped}/${retailerResult.totalProducts} products updated`
              })
            }
          }
          setResults(displayResults)
        }
      } else {
        toast({
          title: "Weekly check failed",
          description: data.error || "Failed to run weekly price check",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger weekly check",
        variant: "destructive"
      })
    } finally {
      setIsRunningWeekly(false)
    }
  }

  const handleTestScrape = async () => {
    if (!selectedProduct || !selectedRetailer) {
      toast({
        title: "Select product and retailer",
        description: "Please select both a retailer and a product to test",
        variant: "destructive"
      })
      return
    }

    setIsTesting(true)
    setTestResult(null)
    
    try {
      const result = await testSingleProductScrape(selectedProduct, selectedRetailer)
      
      setTestResult(result)
      
      if (result.success) {
        toast({
          title: "Test successful",
          description: `Successfully scraped: ${result.productName}`,
        })
      } else {
        toast({
          title: "Test failed",
          description: result.error,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Test error",
        description: "Failed to run test scrape",
        variant: "destructive"
      })
    } finally {
      setIsTesting(false)
    }
  }

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  return (
    <>
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Run Automated Scraping</CardTitle>
          <CardDescription>Select a retailer and start the automated price collection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedRetailer} onValueChange={setSelectedRetailer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select retailer" />
              </SelectTrigger>
              <SelectContent>
                {RETAILERS.map(retailer => (
                  <SelectItem key={retailer} value={retailer}>
                    {retailer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleRunScraping}
              disabled={isRunning || !selectedRetailer}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Scraping
                </>
              )}
            </Button>
            
            <Button
              variant="secondary"
              onClick={handleRunWeeklyCheck}
              disabled={isRunningWeekly}
            >
              {isRunningWeekly ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Weekly Check...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Run Weekly Check (HyVee & ShopRite)
                </>
              )}
            </Button>
          </div>
          
          {/* Product selection for testing */}
          {selectedRetailer && (
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Select Product to Test</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={loadingProducts}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProducts ? "Loading products..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                variant="outline"
                onClick={handleTestScrape}
                disabled={isTesting || !selectedProduct || loadingProducts}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Test Selected Product
                  </>
                )}
              </Button>
            </div>
          )}
          
          {selectedRetailer && availableProducts.length === 0 && !loadingProducts && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No products found with URLs for {selectedRetailer}. Please add product URLs in the products section first.
              </AlertDescription>
            </Alert>
          )}
          
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scraping Results</CardTitle>
            <CardDescription>
              Successfully scraped {successCount} of {results.length} products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.productId}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{result.productName}</p>
                      {result.success && result.price && (
                        <p className="text-sm text-muted-foreground">
                          ${result.price.toFixed(2)}
                          {result.isPromotion && (
                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                              PROMO
                            </span>
                          )}
                          {result.isSoldOut && (
                            <span className="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-1.5 py-0.5 rounded">
                              SOLD OUT
                            </span>
                          )}
                        </p>
                      )}
                      {!result.success && (
                        <p className="text-sm text-red-500">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    View Page
                  </a>
                </div>
              ))}
            </div>
            
            {failureCount > 0 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {failureCount} products failed to scrape. These may need manual entry or the URLs may need to be updated.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
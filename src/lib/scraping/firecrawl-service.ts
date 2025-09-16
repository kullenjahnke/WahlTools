import Firecrawl from '@mendable/firecrawl-js'
import { RETAILER_STORE_CONFIGS } from '@/lib/config/retailer-stores'

export interface ScrapedPrice {
  price: number | null
  isPromotion: boolean
  promotionNotes?: string
  isAvailable: boolean
  isSoldOut: boolean
  rawData?: any
}

export interface ScrapeResult {
  success: boolean
  data?: ScrapedPrice
  error?: string
}

class FirecrawlService {
  private firecrawl: Firecrawl | null = null

  constructor() {
    const apiKey = process.env.FIRECRAWL_API_KEY
    if (apiKey) {
      this.firecrawl = new Firecrawl({ apiKey })
    }
  }

  // Helper method to process scraped content
  private processScrapedContent(result: any, url: string): ScrapeResult {
    if (!result || (!result.markdown && !result.html)) {
      return {
        success: false,
        error: 'No content returned from scrape'
      }
    }

    const markdown = result.markdown || ''
    const html = result.html || ''
    
    // Look for various price patterns
    let price = null
    let originalPrice = null
    let isPromotion = false
    let promotionNotes = undefined
    
    const salePatterns = [
      /\$(\d+\.?\d{0,2})\s*was\s*\$(\d+\.?\d{0,2})/i,
      /now\s*\$(\d+\.?\d{0,2})\s*\$(\d+\.?\d{0,2})/i,
      /\$(\d+\.?\d{0,2})\s*reg\.?\s*\$(\d+\.?\d{0,2})/i,
      /sale\s*\$(\d+\.?\d{0,2})\s*regular\s*\$(\d+\.?\d{0,2})/i,
      /\$(\d+\.?\d{0,2})\s*originally\s*\$(\d+\.?\d{0,2})/i,
    ]
    
    let saleMatch = null
    for (const pattern of salePatterns) {
      saleMatch = markdown.match(pattern)
      if (saleMatch) break
    }
    
    if (saleMatch) {
      price = parseFloat(saleMatch[1])
      originalPrice = parseFloat(saleMatch[2])
      isPromotion = true
      promotionNotes = `Sale: $${price} (was $${originalPrice})`
    } else {
      // Look for regular price patterns
      let priceMatches = markdown.match(/\$(\d+\.\d{2})/g)
      
      if (!priceMatches || priceMatches.length === 0) {
        priceMatches = markdown.match(/\$(\d+\.?\d{0,2})/g)
      }
      
      if (!priceMatches || priceMatches.length === 0) {
        const contextPriceMatch = markdown.match(/(?:price[:\s]+)?(\d+\.\d{2})(?:\s*(?:each|ea|\/)?)/i)
        if (contextPriceMatch) {
          priceMatches = [`$${contextPriceMatch[1]}`]
        }
      }
      
      if (priceMatches && priceMatches.length > 0) {
        const validPrices = priceMatches
          .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
          .filter(p => p > 0.50 && p < 100)
        
        if (validPrices.length > 0) {
          price = validPrices[0]
          
          if (validPrices.length > 1) {
            const savePattern = /save|discount|off|deal|special|promo|sale/i
            if (savePattern.test(markdown)) {
              isPromotion = true
              promotionNotes = "Promotion detected"
            }
          }
        }
      }
      
      if (!price) {
        console.log(`No price found for URL: ${url}`)
        console.log('First 500 chars of markdown:', markdown.substring(0, 500))
      }
    }
    
    const outOfStockPatterns = /out of stock|unavailable|sold out|currently unavailable|no longer available|discontinued/i
    const isSoldOut = outOfStockPatterns.test(markdown)
    const isAvailable = price !== null && !isSoldOut
    
    if (!price) {
      const hasProductInfo = /description|ingredients|nutrition|product details/i.test(markdown)
      if (hasProductInfo) {
        console.log(`Product page found but no price available for: ${url}`)
      }
    }
    
    return {
      success: true,
      data: {
        price,
        isPromotion,
        promotionNotes,
        isAvailable,
        isSoldOut: isSoldOut || (!price && markdown.length > 100),
        rawData: { 
          markdown: markdown.substring(0, 500), 
          price,
          originalPrice,
          detectedPattern: saleMatch ? 'sale' : 'regular',
          noPriceReason: !price ? 'No price found on page - product may be unavailable' : null
        }
      }
    }
  }

  async scrapeHyVeeProduct(url: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      // Scrape the page content with auto proxy (falls back to stealth if needed)
      console.log('Attempting to scrape URL:', url)
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        // Use auto proxy to handle anti-bot protection
        // Automatically retries with stealth proxy if basic fails
        proxy: 'auto'
      } as any)

      console.log('Firecrawl response:', {
        success: result?.success,
        hasMarkdown: !!result?.markdown,
        hasHtml: !!result?.html,
        error: result?.error,
        statusCode: result?.statusCode,
        markdownLength: result?.markdown?.length,
        htmlLength: result?.html?.length
      })

      // Use the helper method to process content
      return this.processScrapedContent(result, url)
    } catch (error) {
      console.error('Firecrawl scraping error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown scraping error'
      }
    }
  }

  async scrapeMultipleProducts(
    urls: Array<{ productId: string; url: string; retailer: string }>
  ): Promise<Map<string, ScrapeResult>> {
    const results = new Map<string, ScrapeResult>()
    
    // Hobby tier: 500 requests/minute 
    // We'll use 200ms delay (300/min) to be safe and avoid bursts
    for (let i = 0; i < urls.length; i++) {
      const { productId, url, retailer } = urls[i]
      
      try {
        let result: ScrapeResult
        
        // Use retailer-specific scraping methods
        switch (retailer.toLowerCase().replace(/[^a-z]/g, '')) {
          case 'hyvee':
            result = await this.scrapeHyVeeProduct(url)
            break
          case 'jewelosco':
            result = await this.scrapeJewelOscoProduct(url)
            break
          case 'stopshop':
            result = await this.scrapeStopShopProduct(url)
            break
          case 'acme':
            result = await this.scrapeAcmeProduct(url)
            break
          case 'shaws':
            result = await this.scrapeShawsProduct(url)
            break
          case 'gianteagle':
            result = await this.scrapeGiantEagleProduct(url)
            break
          case 'giantfoodstores':
            result = await this.scrapeGiantFoodProduct(url)
            break
          case 'bigy':
            result = await this.scrapeBigYProduct(url)
            break
          case 'shoprite':
            result = await this.scrapeShopRiteProduct(url)
            break
          case 'publix':
            result = await this.scrapePublixProduct(url)
            break
          case 'safeway':
            result = await this.scrapeSafewayProduct(url)
            break
          default:
            result = await this.scrapeGenericProduct(url)
        }
        
        results.set(productId, result)
        
        // Add 200ms delay between requests (Hobby plan: 500/min, we use 300/min to be safe)
        if (i < urls.length - 1) {
          console.log(`Processed ${i + 1}/${urls.length} products...`)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error.status === 429 || (error.message && error.message.includes('Rate limit'))) {
          console.error(`Rate limit hit on product ${i + 1}. Waiting 60 seconds before retry...`)
          await new Promise(resolve => setTimeout(resolve, 60000))
          
          // Retry this product
          try {
            const result = await this.scrapeHyVeeProduct(url)
            results.set(productId, result)
          } catch (retryError: any) {
            results.set(productId, {
              success: false,
              error: `Rate limit retry failed: ${retryError.message || 'Unknown error'}`
            })
          }
        } else {
          results.set(productId, {
            success: false,
            error: error.message || 'Scraping failed'
          })
        }
      }
    }
    
    return results
  }

  // Retailer-specific methods (can be customized as needed)
  async scrapeJewelOscoProduct(url: string): Promise<ScrapeResult> {
    // Jewel-Osco is part of Albertsons - requires special handling
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log('Attempting Jewel-Osco scrape with enhanced stealth:', url)
      
      // Try with stealth proxy explicitly and additional options
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        proxy: 'stealth', // Use stealth directly instead of auto
        waitFor: 5000, // Wait 5 seconds for page to load
        // Additional headers to appear more like a real browser
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      } as any)

      // Check if we got captcha blocked
      if (result?.markdown && result.markdown.includes('hCaptcha')) {
        console.log('Jewel-Osco blocked with captcha - marking as manual entry required')
        return {
          success: false,
          error: 'Jewel-Osco requires manual price entry due to anti-bot protection'
        }
      }

      // Process the result if we got through
      return this.processScrapedContent(result, url)
    } catch (error) {
      console.error('Jewel-Osco scraping error:', error)
      return {
        success: false,
        error: 'Jewel-Osco requires manual price entry'
      }
    }
  }

  async scrapeStopShopProduct(url: string): Promise<ScrapeResult> {
    // Stop & Shop (Ahold Delhaize) has aggressive blocking
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log('Attempting Stop & Shop scrape with stealth:', url)
      
      // Use stealth proxy to bypass blocking
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        proxy: 'stealth', // Force stealth mode
        waitFor: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      } as any)
      
      // Check if blocked
      if (!result || result.error === 'ERR_BLOCKED_BY_CLIENT') {
        console.log('Stop & Shop blocked the request')
        return {
          success: false,
          error: 'Stop & Shop requires manual price entry due to blocking'
        }
      }
      
      return this.processScrapedContent(result, url)
    } catch (error: any) {
      console.error('Stop & Shop scraping error:', error)
      if (error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        return {
          success: false,
          error: 'Stop & Shop blocks automated access - manual entry required'
        }
      }
      return {
        success: false,
        error: 'Stop & Shop scraping failed'
      }
    }
  }

  async scrapeAcmeProduct(url: string): Promise<ScrapeResult> {
    // Acme is part of Albertsons family - may have captcha issues
    return this.scrapeAlbertsonsFamily(url, 'Acme')
  }

  async scrapeShawsProduct(url: string): Promise<ScrapeResult> {
    // Shaws is also Albertsons family - may have captcha issues
    return this.scrapeAlbertsonsFamily(url, 'Shaws')
  }

  async scrapeGiantEagleProduct(url: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log('Attempting Giant Eagle scrape:', url)
      
      // Giant Eagle requires store selection for prices
      const storeConfig = RETAILER_STORE_CONFIGS['Giant Eagle']
      
      if (!storeConfig.storeId) {
        console.log('No Giant Eagle store configured - prices may not appear')
        return {
          success: false,
          error: 'Giant Eagle requires store selection. Please configure a store ID in retailer-stores.ts'
        }
      }
      
      // Add store context to the URL if not present
      let scrapeUrl = url
      if (!url.includes('storeId=')) {
        const separator = url.includes('?') ? '&' : '?'
        scrapeUrl = `${url}${separator}storeId=${storeConfig.storeId}`
      }
      
      console.log(`Giant Eagle URL with store (${storeConfig.storeName}):`, scrapeUrl)
      
      const result = await this.firecrawl.scrape(scrapeUrl, {
        formats: ['markdown', 'html'],
        proxy: 'auto',
        waitFor: 5000, // Give more time for price loading
        // Set cookies/headers to simulate store selection
        headers: {
          'Cookie': `storeId=${storeConfig.storeId}; zipCode=${storeConfig.zipCode};`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      } as any)

      if (!result || (!result.markdown && !result.html)) {
        return {
          success: false,
          error: 'No content returned from scrape'
        }
      }

      const markdown = result.markdown || ''
      
      // Giant Eagle specific patterns
      // Look for the main product price (not unit prices or other products)
      let price = null
      let isPromotion = false
      let promotionNotes = undefined
      
      // Giant Eagle patterns:
      // 1. Look for "Current price" or main price indicators
      // 2. Avoid unit prices like "$4.99/lb" 
      // 3. Look for larger prices (main product price is usually bigger in display)
      
      // Try to find price patterns with context
      const pricePatterns = [
        /current\s+price[:\s]*\$(\d+\.?\d{0,2})/i,
        /now[:\s]*\$(\d+\.?\d{0,2})(?!\s*\/)/i, // Avoid unit prices with /
        /price[:\s]*\$(\d+\.?\d{0,2})(?!\s*\/)/i,
        /\$(\d+\.?\d{0,2})(?!\s*\/\s*(?:lb|oz|each|ea))/i // Main price without unit
      ]
      
      for (const pattern of pricePatterns) {
        const match = markdown.match(pattern)
        if (match) {
          const foundPrice = parseFloat(match[1])
          // Giant Eagle burgers are typically $10-20, not $4.99
          if (foundPrice > 7.00 && foundPrice < 30.00) {
            price = foundPrice
            break
          }
        }
      }
      
      // If no price found with context, look for all prices
      if (!price) {
        const allPrices = markdown.match(/\$(\d+\.?\d{0,2})/g)
        if (allPrices) {
          const parsedPrices = allPrices
            .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
            .filter(p => p > 0)
          
          console.log(`Giant Eagle: All prices found: ${parsedPrices.join(', ')}`)
          
          // Look for package price (usually higher) vs unit price (usually lower)
          // For burgers, package price is typically $10-20, unit price is $4-6/lb
          const packagePrices = parsedPrices.filter(p => p > 8.00 && p < 30.00)
          const unitPrices = parsedPrices.filter(p => p > 3.00 && p <= 8.00)
          
          if (packagePrices.length > 0) {
            // Take the first package price (usually the main display price)
            price = packagePrices[0]
            console.log(`Giant Eagle: Selected package price ${price}`)
          } else if (unitPrices.length > 0) {
            // Only unit price found - might need store selection
            price = unitPrices[0]
            console.log(`Giant Eagle: Only found unit price ${price} - store selection may be needed for full price`)
            
            // Check if markdown contains weight info to calculate package price
            const weightMatch = markdown.match(/(\d+(?:\.\d+)?)\s*(?:lb|pound)/i)
            if (weightMatch) {
              const weight = parseFloat(weightMatch[1])
              const estimatedPackagePrice = price * weight
              if (estimatedPackagePrice > 8.00 && estimatedPackagePrice < 30.00) {
                price = Math.round(estimatedPackagePrice * 100) / 100
                console.log(`Giant Eagle: Calculated package price from unit price: $${price}`)
              }
            }
          }
        }
      }
      
      // Check for sales
      if (markdown.match(/save|sale|was \$/i)) {
        isPromotion = true
        promotionNotes = "Sale detected"
      }
      
      // Check availability
      const isSoldOut = /out of stock|unavailable|sold out/i.test(markdown)
      const isAvailable = price !== null && !isSoldOut
      
      if (!price) {
        console.log('Giant Eagle: No valid price found')
        console.log('First 500 chars:', markdown.substring(0, 500))
      }
      
      return {
        success: true,
        data: {
          price,
          isPromotion,
          promotionNotes,
          isAvailable,
          isSoldOut: isSoldOut || (!price && markdown.length > 100),
          rawData: {
            markdown: markdown.substring(0, 500),
            price,
            originalPrice: null,
            detectedPattern: 'giant-eagle-specific',
            noPriceReason: !price ? 'Could not identify main product price' : null
          }
        }
      }
    } catch (error) {
      console.error('Giant Eagle scraping error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async scrapeGiantFoodProduct(url: string): Promise<ScrapeResult> {
    // Giant Food is part of Ahold Delhaize (like Stop & Shop)
    return this.scrapeGenericProduct(url)
  }

  async scrapeBigYProduct(url: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log('Attempting Big Y scrape:', url)
      
      // Big Y requires store selection
      const storeConfig = RETAILER_STORE_CONFIGS['Big Y']
      
      // Add store parameters to URL
      let scrapeUrl = url
      if (storeConfig.storeId) {
        // Big Y uses different URL format for store selection
        const separator = url.includes('?') ? '&' : '?'
        scrapeUrl = `${url}${separator}storeId=${storeConfig.storeId}&zipCode=${storeConfig.zipCode}`
        console.log(`Big Y URL with store (${storeConfig.storeName}):`, scrapeUrl)
      }
      
      // Big Y might need specific handling
      const result = await this.firecrawl.scrape(scrapeUrl, {
        formats: ['markdown', 'html'],
        proxy: 'stealth', // Try stealth mode
        waitFor: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': `storeId=${storeConfig.storeId}; zipCode=${storeConfig.zipCode};`
        }
      } as any)
      
      console.log('Big Y response:', {
        success: result?.success,
        hasContent: !!result?.markdown || !!result?.html,
        error: result?.error,
        statusCode: result?.statusCode
      })
      
      // Check various failure conditions
      if (!result) {
        return {
          success: false,
          error: 'Big Y - No response from scraper'
        }
      }
      
      if (result.error || result.statusCode >= 400) {
        return {
          success: false,
          error: `Big Y requires manual entry - ${result.error || `Status ${result.statusCode}`}`
        }
      }
      
      if (!result.markdown && !result.html) {
        return {
          success: false,
          error: 'Big Y - No content returned'
        }
      }
      
      return this.processScrapedContent(result, url)
    } catch (error: any) {
      console.error('Big Y scraping error:', error)
      return {
        success: false,
        error: `Big Y scraping failed: ${error.message || 'Unknown error'}`
      }
    }
  }

  async scrapeShopRiteProduct(url: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log('Attempting ShopRite scrape:', url)
      
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        proxy: 'auto',
        waitFor: 3000
      } as any)

      if (!result || (!result.markdown && !result.html)) {
        return {
          success: false,
          error: 'No content returned from scrape'
        }
      }

      const markdown = result.markdown || ''
      
      // ShopRite specific price detection
      let price = null
      let originalPrice = null
      let isPromotion = false
      let promotionNotes = undefined
      
      // ShopRite sale patterns - ONLY match explicit sales with two prices
      const salePatterns = [
        /\$(\d+\.?\d{0,2})\s*was\s*\$(\d+\.?\d{0,2})/i,  // "$14.99 was $16.99"
        /sale\s*price[:\s]*\$(\d+\.?\d{0,2})\s*reg\.?\s*\$(\d+\.?\d{0,2})/i, // "Sale Price: $14.99 Reg $16.99"
        /now\s*\$(\d+\.?\d{0,2})\s*was\s*\$(\d+\.?\d{0,2})/i, // "Now $14.99 was $16.99"
      ]
      
      // Check for explicit sale indicators with BOTH prices
      for (const pattern of salePatterns) {
        const match = markdown.match(pattern)
        if (match) {
          price = parseFloat(match[1])
          originalPrice = parseFloat(match[2])
          // ONLY mark as promotion if we have both prices and original is higher
          if (originalPrice && originalPrice > price) {
            isPromotion = true
            promotionNotes = `Sale: was $${originalPrice}`
          }
          break
        }
      }
      
      // If no sale found, look for regular price
      if (!price) {
        // ShopRite patterns for regular price
        const pricePatterns = [
          /\$(\d+\.\d{2})(?!\s*\/)/,  // Price without unit indicator
          /price[:\s]*\$(\d+\.\d{2})/i,
          /^\$(\d+\.\d{2})$/m  // Price on its own line
        ]
        
        for (const pattern of pricePatterns) {
          const match = markdown.match(pattern)
          if (match) {
            price = parseFloat(match[1])
            break
          }
        }
        
        // Fallback: find all prices and take the most likely product price
        if (!price) {
          const allPrices = markdown.match(/\$(\d+\.?\d{0,2})/g)
          if (allPrices) {
            const validPrices = allPrices
              .map(p => parseFloat(p.replace(/[^0-9.]/g, '')))
              .filter(p => p > 8.00 && p < 30.00) // Product price range for burgers
            
            if (validPrices.length > 0) {
              price = validPrices[0]
              console.log(`ShopRite: Selected price ${price} from ${validPrices.length} candidates`)
            }
          }
        }
      }
      
      // DO NOT mark as promotion unless we found explicit sale with two prices
      // ShopRite often has words like "save" in loyalty program text that aren't sales
      
      // Check availability
      const isSoldOut = /out of stock|unavailable|sold out/i.test(markdown)
      const isAvailable = price !== null && !isSoldOut
      
      // FINAL CHECK: Only mark as promotion if we have an original price
      isPromotion = isPromotion && originalPrice !== null
      
      return {
        success: true,
        data: {
          price,
          isPromotion,
          promotionNotes: isPromotion ? promotionNotes : undefined,
          isAvailable,
          isSoldOut,
          rawData: {
            markdown: markdown.substring(0, 500),
            price,
            originalPrice: originalPrice || null,
            detectedPattern: 'shoprite-specific',
            promotionDetected: isPromotion
          }
        }
      }
    } catch (error) {
      console.error('ShopRite scraping error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async scrapePublixProduct(url: string): Promise<ScrapeResult> {
    return this.scrapeGenericProduct(url)
  }

  async scrapeSafewayProduct(url: string): Promise<ScrapeResult> {
    // Safeway is part of Albertsons family - may have captcha issues
    return this.scrapeAlbertsonsFamily(url, 'Safeway')
  }

  // Shared method for Albertsons family stores
  private async scrapeAlbertsonsFamily(url: string, storeName: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      console.log(`Attempting ${storeName} scrape:`, url)
      
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        proxy: 'stealth', // Use stealth for Albertsons stores
        waitFor: 5000
      } as any)

      // Check if blocked by captcha
      if (result?.markdown && (result.markdown.includes('hCaptcha') || result.markdown.includes('security check'))) {
        console.log(`${storeName} blocked with captcha - requires manual entry`)
        return {
          success: false,
          error: `${storeName} requires manual price entry due to anti-bot protection`
        }
      }

      return this.processScrapedContent(result, url)
    } catch (error) {
      console.error(`${storeName} scraping error:`, error)
      return {
        success: false,
        error: `${storeName} requires manual price entry`
      }
    }
  }

  async scrapeGenericProduct(url: string): Promise<ScrapeResult> {
    if (!this.firecrawl) {
      return {
        success: false,
        error: 'Firecrawl API key not configured'
      }
    }

    try {
      const result = await this.firecrawl.scrape(url, {
        formats: ['markdown'],
        // Use auto proxy to handle anti-bot protection
        proxy: 'auto'
      } as any)

      if (!result || !result.success) {
        return {
          success: false,
          error: 'Failed to scrape page'
        }
      }

      const markdown = result.markdown || ''
      
      // Extract price
      const priceMatch = markdown.match(/\$?(\d+\.?\d{0,2})/g)
      const price = priceMatch && priceMatch.length > 0
        ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, ''))
        : null

      // Check availability
      const isSoldOut = /out of stock|unavailable|sold out/i.test(markdown)
      const isAvailable = !isSoldOut && price !== null

      return {
        success: true,
        data: {
          price,
          isPromotion: /sale|save|special|promotion|deal/i.test(markdown),
          promotionNotes: undefined,
          isAvailable,
          isSoldOut,
          rawData: { markdown: markdown.substring(0, 500) }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const firecrawlService = new FirecrawlService()
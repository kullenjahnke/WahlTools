# How to Find Store IDs for Retailers

## Giant Eagle

### Method 1: Network Tab (Recommended)
1. Open Chrome/Edge and go to www.gianteagle.com
2. Open DevTools (F12) and go to the **Network** tab
3. Click "Select Store" and choose your store
4. In the Network tab, look for requests containing:
   - `storeId=` in the URL
   - `store` in the request name
   - API calls to `/api/stores` or similar
5. Click on these requests and check:
   - Request URL parameters
   - Request Headers
   - Response data

### Method 2: Local Storage
1. After selecting a store, go to DevTools > **Application** tab
2. Check:
   - Local Storage > gianteagle.com
   - Session Storage > gianteagle.com
3. Look for keys like:
   - `selectedStore`
   - `storeId`
   - `preferredStore`

### Method 3: JavaScript Console
1. After selecting a store, open DevTools Console
2. Try these commands:
   ```javascript
   // Check window object for store data
   console.log(window.localStorage)
   console.log(window.sessionStorage)
   
   // Look for store in page data
   console.log(document.cookie)
   ```

### Method 4: URL Analysis
Sometimes the store ID appears in the URL after selection:
- Look for patterns like: `/store/0062/` or `?storeId=0062`

## Common Store ID Formats

- **Giant Eagle**: Usually 4 digits like "0062"
- **Stop & Shop**: Often 5 digits like "00123"
- **Publix**: Usually 4 digits like "1234"

## If Store Selection Still Doesn't Work

The issue might be that Giant Eagle:
1. Requires JavaScript rendering to show prices
2. Uses dynamic price loading after page load
3. Has geo-restrictions based on IP location

In this case, we may need to:
- Accept that only unit prices ($4.99/lb) are available via scraping
- Use manual entry for Giant Eagle
// Default store configurations for retailers that require store selection
// You can find store IDs by:
// 1. Going to the retailer's website
// 2. Selecting a store
// 3. Checking the URL parameters or network requests

export const RETAILER_STORE_CONFIGS = {
  'Giant Eagle': {
    storeId: '0062', // Robinson Township, PA
    zipCode: '15656',
    storeName: 'New Kensington'
  },
  'Stop & Shop': {
    storeId: null, // Add when needed
    zipCode: null
  },
  'Giant Food Stores': {
    storeId: null, // Add when needed
    zipCode: null
  },
  'Publix': {
    storeId: null, // Add when needed
    zipCode: null
  },
  'Big Y': {
    storeId: '53', // Springfield, MA store as example
    zipCode: '01103',
    storeName: 'Springfield'
  }
} as const

// Instructions for finding store IDs:
// 
// Giant Eagle:
// 1. Go to gianteagle.com
// 2. Click "Select Store" and choose your store
// 3. Check browser DevTools > Application > Cookies for 'storeId'
// 
// Stop & Shop:
// 1. Go to stopandshop.com
// 2. Select your store
// 3. Check the URL or cookies for store identifier
// 
// Add similar instructions for other retailers as needed
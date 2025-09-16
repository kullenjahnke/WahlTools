-- Migration 09: Ensure product_urls table exists for automation
-- This table stores retailer-specific URLs for each product

CREATE TABLE IF NOT EXISTS product_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_verified TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(product_id, retailer)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_urls_product ON product_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_retailer ON product_urls(retailer);
CREATE INDEX IF NOT EXISTS idx_product_urls_active ON product_urls(is_active);

-- Add comments for documentation
COMMENT ON TABLE product_urls IS 'Stores retailer-specific URLs for products to enable automated price scraping';
COMMENT ON COLUMN product_urls.retailer IS 'Retailer name (e.g., HyVee, Walmart, Meijer)';
COMMENT ON COLUMN product_urls.url IS 'Full URL to the product page on the retailer website';
COMMENT ON COLUMN product_urls.last_verified IS 'Last time this URL was verified as working';

-- Insert some sample URLs for testing (you can modify or remove these)
-- These are just examples and should be replaced with actual product URLs
/*
INSERT INTO product_urls (product_id, retailer, url)
SELECT 
  p.id,
  'HyVee',
  'https://www.hy-vee.com/products/' || LOWER(REPLACE(p.name, ' ', '-'))
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_urls pu 
  WHERE pu.product_id = p.id AND pu.retailer = 'HyVee'
)
LIMIT 5;
*/
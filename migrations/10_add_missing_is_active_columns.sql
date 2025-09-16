-- Migration 10: Add missing is_active columns
-- Some tables are missing the is_active column that the code expects

-- Add is_active to competitor_products if it doesn't exist
ALTER TABLE competitor_products 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add is_active to products table if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_products_active ON competitor_products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Set all existing records to active
UPDATE competitor_products SET is_active = true WHERE is_active IS NULL;
UPDATE products SET is_active = true WHERE is_active IS NULL;

-- Add comments
COMMENT ON COLUMN products.is_active IS 'Whether this product is actively tracked';
COMMENT ON COLUMN competitor_products.is_active IS 'Whether this competitor product is actively tracked';
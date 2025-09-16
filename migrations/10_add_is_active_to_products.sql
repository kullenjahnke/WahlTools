-- Migration 10: Add is_active column to products table
-- This column allows soft deletion and filtering of active products

-- Add is_active to products table if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Set all existing records to active
UPDATE products SET is_active = true WHERE is_active IS NULL;

-- Add comment
COMMENT ON COLUMN products.is_active IS 'Whether this product is actively tracked and shown in the UI';
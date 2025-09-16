-- Migration 02: Update products table with brand fields
-- Run this after creating brands table

-- Add brand-related columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id),
ADD COLUMN IF NOT EXISTS brand_type VARCHAR(50) DEFAULT 'wahlburgers',
ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255) DEFAULT 'Wahlburgers';

-- Add check constraint for brand_type
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_brand_type_check;

ALTER TABLE products 
ADD CONSTRAINT products_brand_type_check 
CHECK (brand_type IN ('wahlburgers', 'competitor'));

-- Update existing Wahlburgers products to have correct brand_id
UPDATE products 
SET brand_id = (SELECT id FROM brands WHERE name = 'Wahlburgers' LIMIT 1)
WHERE brand_id IS NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_type ON products(brand_type);
CREATE INDEX IF NOT EXISTS idx_products_brand_name ON products(brand_name);
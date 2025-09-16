-- Migration 03: Add price tracking fields for promotions
-- Run this after updating products table

-- Add original_price field to prices table for tracking pre-discount prices
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2);

-- Add discount_percentage as a computed field (optional)
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
  CASE 
    WHEN original_price IS NOT NULL AND original_price > 0 AND price < original_price 
    THEN ROUND(((original_price - price) / original_price * 100)::numeric, 2)
    ELSE NULL
  END
) STORED;

-- Add promotion date tracking
ALTER TABLE prices
ADD COLUMN IF NOT EXISTS promotion_start_date DATE,
ADD COLUMN IF NOT EXISTS promotion_end_date DATE;

-- Create index for promotion queries
CREATE INDEX IF NOT EXISTS idx_prices_is_promotion ON prices(is_promotion);
CREATE INDEX IF NOT EXISTS idx_prices_promotion_dates ON prices(promotion_start_date, promotion_end_date);

-- Update existing promotion records to have original_price (if applicable)
-- This is a placeholder - adjust based on your business logic
UPDATE prices 
SET original_price = price * 1.15 -- Assuming 15% discount for existing promotions
WHERE is_promotion = true AND original_price IS NULL;
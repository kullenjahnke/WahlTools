-- Add missing promotion tracking fields to prices table

-- Add on_sale column to track promotional status
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS on_sale BOOLEAN DEFAULT FALSE;

-- Ensure original_price column exists
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2);

-- First drop the existing discount_percentage column if it's a generated column
ALTER TABLE prices 
DROP COLUMN IF EXISTS discount_percentage;

-- Add discount_percentage column as a regular column (not computed)
ALTER TABLE prices 
ADD COLUMN discount_percentage DECIMAL(5,2);

-- Add index for better query performance on promotional items
CREATE INDEX IF NOT EXISTS idx_prices_on_sale 
ON prices(on_sale) 
WHERE on_sale = TRUE;

-- Add index for retailer + product combo with promotions
CREATE INDEX IF NOT EXISTS idx_prices_retailer_product_promo 
ON prices(retailer, product_id, on_sale);

COMMENT ON COLUMN prices.on_sale IS 'Indicates if the product is currently on promotion/sale';
COMMENT ON COLUMN prices.original_price IS 'Original price before discount (only populated when on_sale is true)';
COMMENT ON COLUMN prices.discount_percentage IS 'Calculated discount percentage when on promotion';
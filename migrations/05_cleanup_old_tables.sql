-- Migration 05: Cleanup old competitor tables
-- ⚠️ WARNING: Only run this AFTER verifying all data has been successfully migrated
-- and the new system is working correctly!

-- First, verify migration was successful
DO $$
DECLARE
  old_competitor_products INTEGER;
  migrated_products INTEGER;
BEGIN
  -- Count original competitor products
  SELECT COUNT(*) INTO old_competitor_products FROM competitor_products;
  
  -- Count migrated competitor products in main table
  SELECT COUNT(*) INTO migrated_products 
  FROM products 
  WHERE brand_type = 'competitor';
  
  -- Safety check
  IF old_competitor_products > 0 AND migrated_products = 0 THEN
    RAISE EXCEPTION 'Migration appears incomplete! Found % competitor products but 0 migrated products', old_competitor_products;
  END IF;
  
  RAISE NOTICE 'Found % original competitor products and % migrated products', old_competitor_products, migrated_products;
END $$;

-- Create backup tables before dropping (optional safety measure)
-- Uncomment these lines if you want to keep backup tables
-- ALTER TABLE competitor_prices RENAME TO competitor_prices_backup;
-- ALTER TABLE competitor_product_urls RENAME TO competitor_product_urls_backup;
-- ALTER TABLE competitor_products RENAME TO competitor_products_backup;
-- ALTER TABLE competitors RENAME TO competitors_backup;

-- Drop the old competitor tables
-- ⚠️ DANGER ZONE - This permanently deletes the old tables
-- Comment out these lines if you want to keep the old tables for now
DROP TABLE IF EXISTS competitor_prices CASCADE;
DROP TABLE IF EXISTS competitor_product_urls CASCADE;
DROP TABLE IF EXISTS competitor_products CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Old competitor tables have been removed. Migration complete!';
END $$;
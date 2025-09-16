-- Migration 04: Migrate existing competitor data to unified structure
-- Run this after all table structure changes

-- First, check if there's any data to migrate
DO $$
DECLARE
  competitor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO competitor_count FROM competitor_products;
  
  IF competitor_count > 0 THEN
    RAISE NOTICE 'Found % competitor products to migrate', competitor_count;
    
    -- Migrate competitor products to main products table
    INSERT INTO products (
      id,
      name,
      category_id,
      brand_type,
      brand_name,
      brand_id,
      description,
      created_at,
      updated_at
    )
    SELECT 
      cp.id,
      cp.name,
      cp.category_id,
      'competitor' as brand_type,
      c.name as brand_name,
      b.id as brand_id,
      c.description,
      cp.created_at,
      cp.updated_at
    FROM competitor_products cp
    JOIN competitors c ON cp.competitor_id = c.id
    LEFT JOIN brands b ON b.name = c.name
    ON CONFLICT (id) DO NOTHING;

    -- Migrate competitor URLs to product_urls
    INSERT INTO product_urls (
      id,
      product_id,
      retailer,
      url,
      created_at,
      updated_at
    )
    SELECT 
      id,
      competitor_product_id as product_id,
      retailer,
      url,
      created_at,
      updated_at
    FROM competitor_product_urls
    ON CONFLICT (id) DO NOTHING;

    -- Migrate competitor prices to prices table
    INSERT INTO prices (
      id,
      product_id,
      retailer,
      price,
      timestamp,
      status,
      is_promotion,
      promotion_notes,
      is_sold_out
    )
    SELECT 
      id,
      competitor_product_id as product_id,
      retailer,
      price,
      timestamp,
      status,
      is_promotion,
      promotion_notes,
      is_sold_out
    FROM competitor_prices
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migration completed successfully';
  ELSE
    RAISE NOTICE 'No competitor products found to migrate';
  END IF;
END $$;

-- Add any missing brands from competitors table
INSERT INTO brands (name, type, description)
SELECT DISTINCT 
  c.name,
  'competitor' as type,
  c.description
FROM competitors c
WHERE NOT EXISTS (
  SELECT 1 FROM brands b WHERE b.name = c.name
);
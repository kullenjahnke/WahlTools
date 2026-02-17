-- Migration 06: Migrate remaining competitor product
-- This handles the Signature Blend Patty that was in competitor_products

-- First check if product with this ID exists in main products table
DO $$
DECLARE
  product_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM products WHERE id = '20feba73-a3c6-48b3-a02e-42fba7aac83d'
  ) INTO product_exists;
  
  IF product_exists THEN
    -- Product already exists, just delete from competitor_products
    DELETE FROM competitor_products WHERE id = '20feba73-a3c6-48b3-a02e-42fba7aac83d';
    RAISE NOTICE 'Product already exists in main table, removed duplicate from competitor_products';
  ELSE
    -- Migrate the product to main products table
    INSERT INTO products (
      id,
      name, 
      category_id,
      description,
      brand_type,
      brand_name,
      created_at,
      updated_at
    )
    SELECT 
      cp.id,
      cp.name,
      cp.category_id,
      cp.description,
      'competitor' as brand_type,  -- Mark as competitor
      COALESCE(c.name, 'Unknown Competitor') as brand_name,
      cp.created_at,
      cp.updated_at
    FROM competitor_products cp
    LEFT JOIN competitors c ON cp.brand_id = c.id
    WHERE cp.id = '20feba73-a3c6-48b3-a02e-42fba7aac83d';
    
    -- Delete from old table after migration
    DELETE FROM competitor_products WHERE id = '20feba73-a3c6-48b3-a02e-42fba7aac83d';
    
    RAISE NOTICE 'Migrated Signature Blend Patty to main products table as competitor product';
  END IF;
END $$;

-- Verify migration is complete
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM competitor_products;
  
  IF remaining_count = 0 THEN
    RAISE NOTICE 'Migration complete! All competitor products have been migrated.';
  ELSE
    RAISE WARNING 'Still have % competitor products remaining', remaining_count;
  END IF;
END $$;
-- Migration: Fix 'available' status records to use 'active'
-- Run this in the Supabase SQL Editor
--
-- For each product_id + retailer combo with status = 'available':
--   1. Keep only the latest record (by timestamp), update it to 'active'
--   2. Mark all older records as 'historical'

BEGIN;

-- Step 1: Mark ALL 'available' records as 'historical' first
UPDATE prices
SET status = 'historical'
WHERE status = 'available';

-- Step 2: For each product_id + retailer combo, find the latest 'historical'
-- record that was just converted and promote it to 'active' —
-- but only if there isn't already an 'active' record for that combo.
WITH latest_per_combo AS (
  SELECT DISTINCT ON (product_id, retailer) id
  FROM prices
  WHERE status = 'historical'
  ORDER BY product_id, retailer, timestamp DESC
)
UPDATE prices
SET status = 'active'
FROM latest_per_combo
WHERE prices.id = latest_per_combo.id
  AND NOT EXISTS (
    SELECT 1 FROM prices p2
    WHERE p2.product_id = prices.product_id
      AND p2.retailer = prices.retailer
      AND p2.status = 'active'
  );

COMMIT;

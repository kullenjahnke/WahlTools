-- Migration 13: Add atomic record_price_check RPC function
--
-- Wraps the 3-step price check operation (mark historical, insert new, log check)
-- in a single database transaction to prevent data loss if any step fails.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION record_price_check(
  p_retailer TEXT,
  p_prices JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: Mark existing active prices as historical
  UPDATE prices
  SET status = 'historical'
  WHERE retailer = p_retailer
    AND status = 'active'
    AND product_id IN (
      SELECT (elem->>'product_id')::uuid
      FROM jsonb_array_elements(p_prices) AS elem
    );

  -- Step 2: Insert new active prices
  INSERT INTO prices (product_id, retailer, price, status, is_promotion, promotion_notes, timestamp)
  SELECT
    (elem->>'product_id')::uuid,
    p_retailer,
    (elem->>'price')::numeric,
    'active',
    COALESCE((elem->>'is_promotion')::boolean, false),
    NULLIF(elem->>'promotion_notes', ''),
    NOW()
  FROM jsonb_array_elements(p_prices) AS elem;

  -- Step 3: Log the price check
  INSERT INTO price_check_logs (retailer, completed, check_date, notes)
  VALUES (p_retailer, true, NOW(), COALESCE(p_notes, 'Price check - ' || jsonb_array_length(p_prices) || ' products updated'));
END;
$$;

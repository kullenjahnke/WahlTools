-- Migration 15: Extend record_price_check to handle full per-item status/fields
--
-- Adds status (active|out_of_stock|not_carried), is_sold_out, original_price,
-- discount_percentage to the atomic price-check transaction. Backwards compatible:
-- items without these keys default to a plain active price.
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
  -- Step 1: Mark existing active prices historical for these products
  UPDATE prices
  SET status = 'historical'
  WHERE retailer = p_retailer
    AND status = 'active'
    AND product_id IN (
      SELECT (elem->>'product_id')::uuid
      FROM jsonb_array_elements(p_prices) AS elem
    );

  -- Step 2: Insert new prices with full status/fields
  INSERT INTO prices (
    product_id, retailer, price, status,
    is_promotion, is_sold_out, original_price, discount_percentage,
    promotion_notes, timestamp
  )
  SELECT
    (elem->>'product_id')::uuid,
    p_retailer,
    (elem->>'price')::numeric,
    COALESCE(NULLIF(elem->>'status',''), 'active'),
    COALESCE((elem->>'is_promotion')::boolean, false),
    COALESCE((elem->>'is_sold_out')::boolean, false),
    NULLIF(elem->>'original_price','')::numeric,
    NULLIF(elem->>'discount_percentage','')::numeric,
    NULLIF(elem->>'promotion_notes',''),
    NOW()
  FROM jsonb_array_elements(p_prices) AS elem;

  -- Step 3: Log the completed check
  INSERT INTO price_check_logs (retailer, completed, check_date, completed_at, notes)
  VALUES (
    p_retailer, true, NOW(), NOW(),
    COALESCE(p_notes, 'Price check - ' || jsonb_array_length(p_prices) || ' products updated')
  );
END;
$$;

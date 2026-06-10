-- Migration 25: upsert_historical_price
--
-- Add/adjust a product's price at a retailer for a PAST week. Implements the
-- "one representative value per product+retailer+week" model: it REPLACES any
-- existing rows in the target week, inserts a single row anchored at that week's
-- Monday 12:00 EST, and re-asserts the "latest row is the active one" invariant
-- so backfilling older weeks never disturbs the current price.
--
-- Status is derived from price + is_sold_out:
--   sold out      -> 'out_of_stock'        (price 0, is_sold_out true)
--   N/A           -> 'historical'          (price <= 0, is_sold_out false)
--   available     -> 'active' if this becomes the most-recent row, else 'historical'
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION upsert_historical_price(
  p_product_id  uuid,
  p_retailer    text,
  p_week_start  timestamptz,
  p_price       numeric,
  p_is_sold_out boolean
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_end timestamptz := p_week_start + interval '7 days';
  v_ts         timestamptz := p_week_start + interval '12 hours'; -- Monday noon local (EST/EDT)
  v_is_latest  boolean;
  v_new_status text;
BEGIN
  -- Defensively clear dependent change logs for the rows we're about to delete
  -- (legacy/optional table; FK ON DELETE behavior is undefined in tracked migrations).
  IF to_regclass('public.price_change_logs') IS NOT NULL THEN
    DELETE FROM price_change_logs
    WHERE price_id IN (
      SELECT id FROM prices
      WHERE product_id = p_product_id
        AND retailer = p_retailer
        AND timestamp >= p_week_start
        AND timestamp <  v_window_end
    );
  END IF;

  -- Replace: remove existing rows for this product+retailer inside the target week.
  DELETE FROM prices
  WHERE product_id = p_product_id
    AND retailer = p_retailer
    AND timestamp >= p_week_start
    AND timestamp <  v_window_end;

  -- Will the new row be the most-recent for this product+retailer?
  SELECT NOT EXISTS (
    SELECT 1 FROM prices
    WHERE product_id = p_product_id
      AND retailer = p_retailer
      AND timestamp > v_ts
  ) INTO v_is_latest;

  -- Derive the new row's status.
  IF p_is_sold_out THEN
    v_new_status := 'out_of_stock';
  ELSIF p_price <= 0 THEN
    v_new_status := 'historical';      -- N/A
  ELSIF v_is_latest THEN
    v_new_status := 'active';
  ELSE
    v_new_status := 'historical';
  END IF;

  -- If the new row becomes active, demote any prior active row(s).
  IF v_new_status = 'active' THEN
    UPDATE prices
    SET status = 'historical'
    WHERE product_id = p_product_id
      AND retailer = p_retailer
      AND status = 'active';
  END IF;

  -- Insert the single representative row for the week.
  INSERT INTO prices (product_id, retailer, price, status, is_sold_out, timestamp)
  VALUES (p_product_id, p_retailer, p_price, v_new_status, p_is_sold_out, v_ts);
END;
$$;

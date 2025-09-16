-- Migration 07: Fix discount_percentage column to be a regular column instead of generated
-- This fixes the "cannot insert non-DEFAULT value" error

-- First, drop the existing generated column
ALTER TABLE prices 
DROP COLUMN IF EXISTS discount_percentage CASCADE;

-- Recreate as a regular column that can accept values
ALTER TABLE prices 
ADD COLUMN discount_percentage DECIMAL(5,2);

-- Add comment for clarity
COMMENT ON COLUMN prices.discount_percentage IS 'Calculated discount percentage (not auto-generated, calculated by application)';
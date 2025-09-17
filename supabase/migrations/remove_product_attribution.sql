-- Migration to remove attribution columns from products table
-- These columns were added but decided against tracking user attribution
-- Run this migration in your Supabase SQL editor to clean up the database

-- First, check if the columns exist and drop them if they do
DO $$
BEGIN
    -- Drop created_by column if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE products DROP COLUMN created_by;
    END IF;

    -- Drop updated_by column if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE products DROP COLUMN updated_by;
    END IF;
END $$;

-- Also drop the activity_logs table if it exists since we're no longer tracking activity
DROP TABLE IF EXISTS activity_logs CASCADE;
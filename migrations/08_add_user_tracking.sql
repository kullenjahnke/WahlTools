-- Migration 08: Add user tracking fields
-- This adds audit fields to track which user performed actions

-- Add user tracking to prices table
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Add user tracking to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Create an activity log table for detailed tracking
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create_product', 'update_product', 'add_price', etc.
  entity_type TEXT NOT NULL, -- 'product', 'price', 'brand', etc.
  entity_id UUID,
  entity_name TEXT, -- Store the name for quick reference
  details JSONB, -- Store additional details like old/new values
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Create a view for recent activity with readable format
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
  al.id,
  al.user_email,
  CASE 
    WHEN al.user_email LIKE '%@arkkfood.com' THEN 
      UPPER(SUBSTRING(al.user_email FROM 1 FOR 1)) || UPPER(SUBSTRING(SPLIT_PART(al.user_email, '@', 1) FROM '[^.]+$'))
    ELSE 
      UPPER(SUBSTRING(SPLIT_PART(al.user_email, '@', 1) FROM 1 FOR 2))
  END as user_initials,
  al.action,
  al.entity_type,
  al.entity_name,
  al.details,
  al.created_at,
  CASE
    WHEN al.created_at > NOW() - INTERVAL '1 hour' THEN 
      EXTRACT(MINUTE FROM NOW() - al.created_at) || ' minutes ago'
    WHEN al.created_at > NOW() - INTERVAL '24 hours' THEN 
      EXTRACT(HOUR FROM NOW() - al.created_at) || ' hours ago'
    WHEN al.created_at > NOW() - INTERVAL '7 days' THEN 
      EXTRACT(DAY FROM NOW() - al.created_at) || ' days ago'
    ELSE 
      TO_CHAR(al.created_at, 'Mon DD, YYYY')
  END as time_ago
FROM activity_logs al
ORDER BY al.created_at DESC
LIMIT 100;

-- Add comment for documentation
COMMENT ON TABLE activity_logs IS 'Tracks all user actions for audit purposes';
COMMENT ON COLUMN prices.created_by IS 'Email of user who first added this price';
COMMENT ON COLUMN prices.updated_by IS 'Email of user who last updated this price';
COMMENT ON COLUMN products.created_by IS 'Email of user who created this product';
COMMENT ON COLUMN products.updated_by IS 'Email of user who last updated this product';
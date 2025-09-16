-- Migration 11: Create price_check_logs table
-- This table tracks when price checks are performed for each retailer

CREATE TABLE IF NOT EXISTS price_check_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  retailer TEXT NOT NULL,
  check_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed BOOLEAN DEFAULT false,
  completed_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_check_logs_retailer ON price_check_logs(retailer);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_check_date ON price_check_logs(check_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_check_logs_completed ON price_check_logs(completed);

-- Add comment for documentation
COMMENT ON TABLE price_check_logs IS 'Tracks price check completion status for each retailer';
COMMENT ON COLUMN price_check_logs.retailer IS 'The retailer for which the price check was performed';
COMMENT ON COLUMN price_check_logs.check_date IS 'When the price check was initiated';
COMMENT ON COLUMN price_check_logs.completed IS 'Whether the price check was completed';
COMMENT ON COLUMN price_check_logs.completed_by IS 'Email of user who completed the price check';
COMMENT ON COLUMN price_check_logs.completed_at IS 'When the price check was completed';
COMMENT ON COLUMN price_check_logs.notes IS 'Optional notes about the price check';
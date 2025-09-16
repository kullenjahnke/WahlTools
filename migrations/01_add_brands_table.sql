-- Migration 01: Create brands table for dynamic brand management
-- Run this first

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL DEFAULT 'competitor',
  description TEXT,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for brand type
ALTER TABLE brands 
ADD CONSTRAINT brand_type_check 
CHECK (type IN ('wahlburgers', 'competitor'));

-- Insert default brands
INSERT INTO brands (name, type, description) VALUES 
  ('Wahlburgers', 'wahlburgers', 'Wahlburgers products'),
  ('Beyond Meat', 'competitor', 'Plant-based meat alternatives'),
  ('Impossible Foods', 'competitor', 'Plant-based meat alternatives'),
  ('Applegate', 'competitor', 'Natural and organic meat products'),
  ('Butterball', 'competitor', 'Turkey and poultry products'),
  ('Jennie-O', 'competitor', 'Turkey products'),
  ('Perdue', 'competitor', 'Chicken and turkey products'),
  ('Tyson', 'competitor', 'Meat and poultry products'),
  ('Ball Park', 'competitor', 'Hot dogs and meat products'),
  ('Oscar Mayer', 'competitor', 'Deli meats and hot dogs')
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_brands_type ON brands(type);
CREATE INDEX idx_brands_name ON brands(name);
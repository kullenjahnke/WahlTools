# Product System Unification Migration Plan

## Overview
Unify the separate Wahlburgers and Competitor product systems into a single, cohesive product management system.

## Current State Analysis

### Existing Tables Structure

#### Wahlburgers Products
- **products** - Main product table
  - Fields: id, name, category_id, upc, description, internal_notes, aliases, created_at, updated_at
- **product_urls** - Retailer URLs for products
  - Fields: id, product_id, retailer, url, created_at, updated_at
- **prices** - Price tracking
  - Fields: id, product_id, retailer, price, timestamp, status, is_promotion, promotion_notes, is_sold_out
- **product_images** - Product images
  - Fields: id, product_id, url, type, main

#### Competitor Products (Separate System)
- **competitors** - Competitor brands
  - Fields: id, name, description, created_at, updated_at
- **competitor_products** - Competitor product details
  - Fields: id, competitor_id, name, category_id, related_product_id, is_active, weight_oz
- **competitor_product_urls** - Retailer URLs
  - Fields: id, competitor_product_id, retailer, url
- **competitor_prices** - Price tracking
  - Fields: id, competitor_product_id, retailer, price, timestamp, status, is_promotion, promotion_notes, is_sold_out

### Problems with Current Structure
1. Duplicate functionality across two systems
2. Competitor products missing fields (upc, description, internal_notes, aliases)
3. Separate UI/UX workflows
4. Code duplication
5. Difficult to compare products side-by-side

## Migration Strategy

### Phase 1: Database Schema Changes

#### Step 1.1: Add Brand Fields to Products Table
```sql
-- Add brand-related columns to products table
ALTER TABLE products 
ADD COLUMN brand_type VARCHAR(50) DEFAULT 'wahlburgers',
ADD COLUMN brand_name VARCHAR(255) DEFAULT 'Wahlburgers',
ADD COLUMN weight_oz DECIMAL(10,2),
ADD COLUMN related_product_id UUID REFERENCES products(id);

-- Add constraint for brand_type
ALTER TABLE products 
ADD CONSTRAINT brand_type_check 
CHECK (brand_type IN ('wahlburgers', 'competitor'));
```

#### Step 1.2: Create Brand Lookup Table (Optional)
```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default brands
INSERT INTO brands (name, type, description) VALUES 
('Wahlburgers', 'wahlburgers', 'Wahlburgers products'),
('Beyond Meat', 'competitor', 'Plant-based meat alternative'),
('Impossible Foods', 'competitor', 'Plant-based meat alternative'),
('Applegate', 'competitor', 'Natural and organic meats');
```

### Phase 2: Data Migration

#### Step 2.1: Migrate Competitor Data
```sql
-- Migrate competitor products to main products table
INSERT INTO products (
  id,
  name,
  category_id,
  brand_type,
  brand_name,
  weight_oz,
  related_product_id,
  created_at,
  updated_at
)
SELECT 
  cp.id,
  cp.name,
  cp.category_id,
  'competitor' as brand_type,
  c.name as brand_name,
  cp.weight_oz,
  cp.related_product_id,
  cp.created_at,
  cp.updated_at
FROM competitor_products cp
JOIN competitors c ON cp.competitor_id = c.id;

-- Migrate competitor URLs to product_urls
INSERT INTO product_urls (
  id,
  product_id,
  retailer,
  url,
  created_at,
  updated_at
)
SELECT 
  id,
  competitor_product_id as product_id,
  retailer,
  url,
  created_at,
  updated_at
FROM competitor_product_urls;

-- Migrate competitor prices to prices table
INSERT INTO prices (
  id,
  product_id,
  retailer,
  price,
  timestamp,
  status,
  is_promotion,
  promotion_notes,
  is_sold_out
)
SELECT 
  id,
  competitor_product_id as product_id,
  retailer,
  price,
  timestamp,
  status,
  is_promotion,
  promotion_notes,
  is_sold_out
FROM competitor_prices;
```

### Phase 3: UI/UX Updates

#### Components to Update:
1. **Product Form Component**
   - Add brand selector (dropdown)
   - Show all fields for both product types
   - Conditional fields based on brand type

2. **Product List Pages**
   - Add brand filter
   - Show brand badge/indicator
   - Unified search across all products

3. **Price Tracking**
   - Single interface for all products
   - Brand-aware price comparisons

4. **Analytics/Reports**
   - Compare Wahlburgers vs competitors
   - Market share analysis

### Phase 4: Code Changes

#### Files to Modify:
1. `/src/types/database.ts` - Update type definitions
2. `/src/app/(dashboard)/products/new/page.tsx` - New unified form
3. `/src/app/(dashboard)/products/page.tsx` - Updated listing
4. `/src/components/products/*` - Update all product components
5. `/src/app/(dashboard)/prices/*` - Update price tracking

### Phase 5: Cleanup

#### After Successful Migration:
```sql
-- Drop old competitor tables (after verification)
DROP TABLE IF EXISTS competitor_prices CASCADE;
DROP TABLE IF EXISTS competitor_product_urls CASCADE;
DROP TABLE IF EXISTS competitor_products CASCADE;
DROP TABLE IF EXISTS competitors CASCADE;
```

## Rollback Plan

### If Issues Occur:
1. Restore from backup
2. Keep old tables until verified
3. Dual-write during transition period

### Backup Commands:
```bash
# Before migration
pg_dump -h [host] -U [user] -d [database] > backup_$(date +%Y%m%d).sql

# After migration verification
pg_dump -h [host] -U [user] -d [database] > backup_post_migration_$(date +%Y%m%d).sql
```

## Testing Checklist

### Pre-Migration:
- [ ] Full database backup created
- [ ] Test environment ready
- [ ] All stakeholders notified

### Post-Migration:
- [ ] All Wahlburgers products visible
- [ ] Migrated competitor products visible
- [ ] Price history preserved
- [ ] URLs working correctly
- [ ] Can add new products (both types)
- [ ] Can update prices
- [ ] Analytics/reports working
- [ ] No broken references

## Timeline

1. **Day 1**: Database backup & schema changes
2. **Day 2**: Data migration & verification
3. **Day 3-4**: UI component updates
4. **Day 5**: Testing & bug fixes
5. **Day 6**: Production deployment
6. **Day 7**: Monitoring & cleanup

## Risk Assessment

### Low Risk:
- Adding columns to existing tables
- Creating new UI components

### Medium Risk:
- Data migration (mitigated by backups)
- Foreign key relationships

### High Risk:
- None identified with proper backups

## Success Criteria

1. Single unified product management interface
2. All historical data preserved
3. No downtime during migration
4. Improved user experience
5. Easier maintenance going forward
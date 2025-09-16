# Database Migration Guide

## Overview
This migration unifies the Wahlburgers and Competitor product systems into a single, streamlined product management system.

## Pre-Migration Checklist

- [ ] **Create Backup** - Go to http://localhost:3000/dashboard/backup and export all data
- [ ] **Supabase SQL Backup** - Create a backup in Supabase Dashboard (Settings → Database → Backups)
- [ ] **Review Migration Scripts** - Check all SQL files in this folder
- [ ] **Test Environment** - Consider testing in a development database first

## Migration Steps

### Step 1: Create Backup
1. Navigate to http://localhost:3000/dashboard/backup
2. Click "Export All Data" to download JSON backup
3. Save the file in a safe location
4. Also create a SQL backup in Supabase Dashboard

### Step 2: Run Migration Scripts in Order

Go to your Supabase Dashboard → SQL Editor and run each script in order:

#### Script 1: Create Brands Table
```sql
-- Run migrations/01_add_brands_table.sql
-- Creates brands table and adds default brands
```

#### Script 2: Update Products Table  
```sql
-- Run migrations/02_update_products_table.sql
-- Adds brand fields to products table
```

#### Script 3: Add Price Fields
```sql
-- Run migrations/03_add_price_fields.sql
-- Adds original_price and promotion tracking fields
```

#### Script 4: Migrate Competitor Data
```sql
-- Run migrations/04_migrate_competitor_data.sql
-- Migrates any existing competitor products to unified structure
```

#### Script 5: Cleanup (Optional - After Verification)
```sql
-- Run migrations/05_cleanup_old_tables.sql
-- ⚠️ WARNING: Only run after verifying everything works!
-- This permanently removes old competitor tables
```

## Post-Migration Verification

### Database Checks
- [ ] All Wahlburgers products still visible
- [ ] Competitor products (if any) migrated successfully
- [ ] Price history preserved
- [ ] Product URLs intact
- [ ] All relationships maintained

### Application Testing
- [ ] Can view all products
- [ ] Can add new Wahlburgers product
- [ ] Can add new competitor product
- [ ] Can update prices with original_price
- [ ] Can filter by brand
- [ ] Comparison features work

## Rollback Instructions

If something goes wrong:

1. **Restore from JSON backup:**
   - Use the JSON file you exported
   - Manually reimport data

2. **Restore from SQL backup:**
   - Go to Supabase Dashboard
   - Restore from the backup you created

3. **If migration partially completed:**
   - The old tables are preserved until you run script 05
   - You can manually reverse the changes

## New Features After Migration

1. **Unified Product Management**
   - Single interface for all products
   - Brand selector when adding products
   - Consistent fields across all products

2. **Dynamic Brand Management**
   - Add new brands as needed
   - Manage brand information centrally

3. **Enhanced Price Tracking**
   - Original price for promotions
   - Discount percentage calculation
   - Promotion date tracking

4. **Flexible Product Comparison**
   - Compare any products regardless of brand
   - Side-by-side price analysis
   - Market share insights

## Next Steps

After successful migration:
1. Update the TypeScript types (will be done automatically)
2. Test the new unified Add Product form
3. Verify all existing features still work
4. Start adding competitor products

## Troubleshooting

**Issue: Migration script fails**
- Check error message in SQL editor
- Verify previous scripts completed successfully
- Ensure you have proper permissions

**Issue: Data missing after migration**
- Check if migration script 04 ran successfully
- Verify data existed before migration
- Restore from backup if needed

**Issue: Application errors after migration**
- Clear browser cache
- Restart development server
- Check browser console for errors

## Support

If you encounter issues:
1. Don't run the cleanup script (05) until everything is verified
2. Keep your backups until system is stable
3. The old competitor tables are preserved until cleanup
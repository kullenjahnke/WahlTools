-- Cleanup: remove stray retailer='HyVee' price rows
--
-- HyVee is NOT one of the 9 configured retailers (src/lib/config/retailers.ts).
-- It surfaced on the Prices table only because the table built its retailer
-- columns from whatever retailer values existed in `prices`. The code now also
-- filters retailers against the config (retailer-price-table.tsx), so HyVee can
-- no longer render regardless of this cleanup. This script removes the stray
-- rows so they stop polluting queries/exports.
--
-- ⚠️ DESTRUCTIVE + IRREVERSIBLE. Run manually in the Supabase SQL Editor, in
-- order, and ONLY after confirming the previewed rows are exactly what you
-- expect.

-- Step 1 (READ-ONLY): preview the rows that would be deleted. Run this first.
SELECT id, product_id, retailer, price, status, timestamp
FROM prices
WHERE retailer = 'HyVee'
ORDER BY timestamp DESC;

-- Step 1b (READ-ONLY): sanity count.
-- SELECT count(*) AS hyvee_rows FROM prices WHERE retailer = 'HyVee';

-- Step 2 (DESTRUCTIVE): only after confirming Step 1's rows, delete them.
-- Uncomment and run this statement on its own.
-- DELETE FROM prices WHERE retailer = 'HyVee';

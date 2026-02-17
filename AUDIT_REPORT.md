# Wahlburgers Price Tracker - Audit Report

**Date:** 2026-02-17
**Audited by:** Claude Code
**Stack:** Next.js 15.1.6 / Supabase / TypeScript / Tailwind CSS
**Data Volume:** Small (<1,000 rows)
**Known Symptoms:** Slow page loads, Supabase RLS performance warnings

---

## Executive Summary

The application has **6 critical issues**, **9 high-priority issues**, and **12 medium/low items**. The primary cause of slow page loads is a combination of **Supabase RLS policy misconfigurations** (reported by Supabase itself) and **inefficient query patterns** in the application code. Additionally, the build pipeline silently ignores all TypeScript and ESLint errors, which masks bugs.

---

## CRITICAL - Fix Immediately

### C1. Supabase RLS: Duplicate Permissive Policies
**Impact:** Every query on affected tables evaluates multiple overlapping policies, degrading performance.
**Symptom:** Supabase warning: *"Table public.products has multiple permissive policies for role authenticated for action UPDATE"*

**Affected tables (from Supabase warnings):**
- `products` - duplicate UPDATE policies: `"Enable update for authenticated users"` + `"Products are editable by admins"`
- Likely similar duplicates on other tables (prices, product_images, product_urls, etc.)

**Fix:** For each affected table, consolidate duplicate policies into a single policy per action. If you need both "any authenticated user" and "admin only" behavior, use a single policy with a conditional check, or make one RESTRICTIVE instead of both being PERMISSIVE.

```sql
-- Example: Consolidate into one UPDATE policy
DROP POLICY "Enable update for authenticated users" ON public.products;
DROP POLICY "Products are editable by admins" ON public.products;

CREATE POLICY "authenticated_update_products" ON public.products
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
```

### C2. Supabase RLS: Per-Row Auth Function Re-evaluation
**Impact:** `auth.uid()` / `auth.role()` re-evaluated for every row instead of once per query. Causes O(n) function calls per query.
**Symptom:** Supabase warning: *"re-evaluates current_setting() or auth.\<function\>() for each row"*

**Affected tables (from Supabase warnings):**
- `price_change_logs` - INSERT policy `"Enable insert access for authenticated users"`
- Likely similar issues across all tables with RLS policies using `auth.uid()`

**Fix:** Wrap `auth.uid()` and `auth.role()` in a subselect so PostgreSQL evaluates them once:

```sql
-- BEFORE (slow - evaluated per row):
CREATE POLICY "enable_insert" ON public.price_change_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- AFTER (fast - evaluated once):
CREATE POLICY "enable_insert" ON public.price_change_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);
```

**Action:** Audit ALL RLS policies across ALL tables and apply the `(select auth.<function>())` pattern everywhere. Based on the ~25 warnings reported, this likely affects most tables.

### C3. Build Pipeline Ignores All Errors
**File:** `next.config.ts:6-10`

```ts
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

**Impact:** Production builds succeed even with type errors, broken imports, and lint violations. Bugs ship silently. This is the most dangerous configuration in the codebase because it masks every other issue.

**Fix:** Remove both flags and fix all resulting build errors.

### C4. API Route Uses `getSession()` Instead of `getUser()`
**File:** `src/app/api/prices/bulk-update/route.ts:7`

```ts
const { data: { session } } = await supabase.auth.getSession();
```

**Impact:** Per Supabase SSR docs, `getSession()` reads the JWT from cookies **without server-side validation**. An attacker could forge a JWT cookie and bypass authentication on this endpoint. The dashboard layout correctly uses `getUser()` already.

**Fix:** Replace with `getUser()`:
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) { return new NextResponse('Unauthorized', { status: 401 }); }
```

### C5. Non-Atomic Price Updates (Data Loss Risk)
**File:** `src/app/actions/prices.ts:172-232` (`recordPriceCheck`)

The function does 3 separate operations:
1. UPDATE existing prices to `status: 'historical'`
2. INSERT new price records
3. INSERT price check log

If step 2 fails after step 1 succeeds, prices are marked historical but new prices are never inserted - **data is lost**. Supabase JS doesn't support client-side transactions.

**Fix:** Create a Supabase database function (RPC) that wraps these operations in a PostgreSQL transaction:

```sql
CREATE OR REPLACE FUNCTION record_price_check(
  p_retailer TEXT,
  p_prices JSONB,
  p_notes TEXT
) RETURNS VOID AS $$
BEGIN
  -- Mark existing as historical
  UPDATE prices SET status = 'historical'
  WHERE retailer = p_retailer
    AND product_id = ANY(SELECT (elem->>'product_id')::uuid FROM jsonb_array_elements(p_prices) elem)
    AND status = 'active';

  -- Insert new prices
  INSERT INTO prices (product_id, retailer, price, status, is_promotion, promotion_notes, timestamp)
  SELECT
    (elem->>'product_id')::uuid,
    p_retailer,
    (elem->>'price')::numeric,
    'active',
    COALESCE((elem->>'is_promotion')::boolean, false),
    elem->>'promotion_notes',
    NOW()
  FROM jsonb_array_elements(p_prices) elem;

  -- Log the check
  INSERT INTO price_check_logs (retailer, completed, check_date, notes)
  VALUES (p_retailer, true, NOW(), p_notes);
END;
$$ LANGUAGE plpgsql;
```

### C6. Non-Atomic Bulk Price Update API
**File:** `src/app/api/prices/bulk-update/route.ts:25-51`

Same issue - loops through updates one at a time with no transaction. If any update fails mid-loop, partial updates are committed.

**Fix:** Same approach - use an RPC function or batch the updates in a single query.

---

## HIGH - Fix Soon

### H1. Dashboard Fetches ALL Products with ALL Prices
**File:** `src/app/(dashboard)/dashboard/page.tsx:53-66`

```ts
supabase.from('products').select('*, prices (*)').eq('brand_id', 'competitor')
supabase.from('products').select('*, prices (*)')
```

This fetches **every historical price record** for **every product** on every dashboard load. Even with <1,000 price rows this is wasteful; it will become a major bottleneck as data grows.

**Fix:** Only fetch what's needed:
- Use `prices!inner(*)` with `.eq('prices.status', 'active')` to get only active prices
- Or better: only select the fields actually used by dashboard components
- Consider a database view or RPC for the dashboard summary

### H2. `getPriceChangeStats()` N+1 Query Pattern
**File:** `src/app/actions/prices.ts:92-169`

Fires **2 queries per retailer** inside `Promise.all()`. With 11 retailers configured, that's **22 database round-trips** per call.

**Fix:** Replace with a single query that groups by retailer:
```ts
const { data } = await supabase
  .from('prices')
  .select('retailer, product_id, price, timestamp, status')
  .gte('timestamp', thirtyDaysAgo.toISOString())
  .order('timestamp', { ascending: true });
// Then process grouping in JavaScript
```

### H3. `retailerCount` Query Returns Only 1 Row
**File:** `src/app/(dashboard)/dashboard/page.tsx:48-51`

```ts
supabase.from('prices').select('retailer').eq('status', 'active').limit(1)
```

This fetches only 1 price row but then calculates `uniqueRetailers` from it (which will always be 0 or 1). Should remove `limit(1)` or use a `distinct` approach.

### H4. Hardcoded Email Whitelist in Cron Route
**File:** `src/app/api/cron/weekly-price-check/route.ts:20-24`

```ts
const allowedEmails = ['info@kullenjahnke.com', 'kdjahnke@arkkfood.com', 'rjahnke@arkkfood.com']
```

Duplicates the whitelist from `src/lib/auth/whitelist.ts`. If you update one, you'll miss the other.

**Fix:** Import and use `isEmailAuthorized()` from `@/lib/auth/whitelist`.

### H5. Error Messages Leak Internal Details
**File:** `src/app/api/prices/bulk-update/route.ts:59-62`

```ts
'Internal Server Error: ' + (error instanceof Error ? error.message : 'Unknown error')
```

Returns raw error messages (potentially including DB schema details) to clients.

**Fix:** Log the full error server-side, return a generic message to clients.

### H6. Image Deletion Path Extraction is Fragile
**File:** `src/app/actions/images.ts:81`

```ts
const filePath = url.split('/').pop()
```

Upload path is `${productId}/${timestamp}.${ext}` (nested), but deletion extracts only the last segment. The storage `remove()` call will fail silently, leaving orphaned files.

**Fix:** Extract the full path after the bucket name:
```ts
const filePath = url.split('/product-images/')[1]
```

### H7. No Loading States (Streaming/Suspense)
**Missing files:** No `loading.tsx` in any route segment.

Users see nothing while server components fetch data, contributing to the "slow page load" perception.

**Fix:** Add `loading.tsx` files to key routes:
- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/(dashboard)/dashboard/products/loading.tsx`
- `src/app/(dashboard)/dashboard/prices/loading.tsx`

### H8. No Route-Level Error Boundaries
**Missing files:** No `error.tsx` in any route segment.

Currently, errors are caught in try/catch blocks and render inline error messages. This means a component error crashes the entire page instead of showing a recoverable error UI.

**Fix:** Add `error.tsx` files with retry functionality to key routes.

### H9. `price_change_logs` Table May Not Exist
**File:** `src/app/api/prices/bulk-update/route.ts:41-48`

The bulk update route inserts into `price_change_logs`, but this table is not defined in `src/types/supabase.ts`. The migration files show `price_check_logs` (different table). This route may be silently failing.

**Verify:** Check if `price_change_logs` exists in your Supabase database. If not, create a migration or remove the dead code.

---

## MEDIUM - Plan to Fix

### M1. 151 Console.log Statements Across 47 Files
Production code is noisy with debug logging. Examples:
- `src/app/actions/products.ts` - logs every create/update/delete with "Revalidating path" messages
- `src/app/actions/images.ts` - logs every upload step
- `src/app/(dashboard)/dashboard/prices/check/page.tsx` - logs product/category counts

**Fix:** Remove debug `console.log` statements. Keep `console.error` for actual error conditions. Consider a structured logging library for production observability.

### M2. No Pagination on Data-Heavy Pages
Queries in server actions and pages fetch all matching rows without limits. Key areas:
- `fetchLatestPrices()` - no limit
- `fetchProductPriceHistory()` - no limit (only date filter)
- Products list page - fetches all products

**Fix:** Add pagination (limit/offset) or cursor-based pagination as data grows.

### M3. Client Component Count is High (71 files)
Not all 71 `'use client'` files necessarily need interactivity. Some may be using client hooks unnecessarily.

**Recommendation:** Audit components to see if any can be converted to server components, reducing the client JS bundle.

### M4. Missing `AUTHORIZED_EMAILS` Env Variable Documentation
**File:** `src/lib/auth/whitelist.ts` reads `process.env.AUTHORIZED_EMAILS` but this isn't listed in the CLAUDE.md env variable section or `.env.example`.

### M5. Duplicate Migration Numbering
Two files named `06_*` and two named `10_*` in `/migrations/`:
- `06_add_price_promotion_fields.sql` and `06_migrate_remaining_competitor.sql`
- `10_add_is_active_to_products.sql` and `10_add_missing_is_active_columns.sql`

---

## LOW - Nice to Have

### L1. Default README is Create Next App Template
`README.md` is still the default boilerplate from `create-next-app`.

### L2. GET Route Handler Not Cached
**File:** `src/app/api/prices/history/route.ts`

In Next.js 15, GET handlers are not cached by default. If this endpoint is called frequently, add caching:
```ts
export const revalidate = 60; // cache for 60 seconds
```

### L3. No `not-found.tsx` for Dynamic Routes
Dynamic routes like `products/[id]` and `competitors/[id]` don't handle 404 cases.

### L4. `xlsx` Package in devDependencies
`xlsx` is listed in devDependencies but if it's used at runtime (e.g., for CSV/Excel exports), it should be in dependencies.

---

## Priority Action Plan

### Phase 1: Immediate (fixes slow page loads + security)
1. **Fix ALL Supabase RLS policies** (C1, C2) - This is the #1 cause of slow queries
2. **Fix `getSession()` security issue** (C4) - one-line fix
3. **Fix retailerCount query** (H3) - one-line fix
4. **Fix dashboard over-fetching** (H1) - reduce data transferred
5. **Add loading.tsx skeletons** (H7) - improves perceived performance

### Phase 2: Short-term (stability + correctness)
6. **Re-enable TypeScript/ESLint in builds** (C3) - fix all resulting errors
7. **Create database transactions for price updates** (C5, C6)
8. **Fix N+1 in getPriceChangeStats** (H2)
9. **Fix image deletion path** (H6)
10. **Add error.tsx boundaries** (H8)

### Phase 3: Cleanup
11. Remove console.log statements (M1)
12. Deduplicate hardcoded whitelist (H4)
13. Add pagination (M2)
14. Fix migration numbering (M5)

---

## Files Referenced

| File | Issues |
|------|--------|
| `next.config.ts` | C3 |
| `src/middleware.ts` | OK (follows Supabase SSR best practices) |
| `src/lib/supabase/server.ts` | OK |
| `src/lib/supabase/client.ts` | OK |
| `src/app/(dashboard)/dashboard/page.tsx` | H1, H3 |
| `src/app/(dashboard)/dashboard/layout.tsx` | OK |
| `src/app/actions/prices.ts` | C5, H2 |
| `src/app/actions/products.ts` | M1 |
| `src/app/actions/images.ts` | H6, M1 |
| `src/app/api/prices/bulk-update/route.ts` | C4, C6, H5, H9 |
| `src/app/api/prices/history/route.ts` | L2 |
| `src/app/api/cron/weekly-price-check/route.ts` | H4 |
| `src/lib/auth/whitelist.ts` | M4 |
| Supabase RLS policies (all tables) | C1, C2 |

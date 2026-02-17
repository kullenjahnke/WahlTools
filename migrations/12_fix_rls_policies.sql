-- Migration 12: Fix RLS Policy Performance Issues
--
-- Fixes two Supabase performance warnings:
-- 1. Duplicate permissive policies for same role/action (consolidate into one per action)
-- 2. auth.uid()/auth.role() evaluated per-row instead of once (wrap in subselect)
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- Each table is handled independently via DO blocks with exception handling,
-- so if a table doesn't exist it will be skipped without affecting the others.

-- Helper function to rebuild RLS policies for a table
-- Drops ALL existing policies, then creates clean ones with (select auth.uid())
CREATE OR REPLACE FUNCTION _fix_rls_for_table(table_name TEXT, actions TEXT[] DEFAULT ARRAY['SELECT','INSERT','UPDATE','DELETE'])
RETURNS VOID AS $$
DECLARE
  pol RECORD;
  act TEXT;
  policy_name TEXT;
BEGIN
  -- Drop ALL existing policies on this table (regardless of name)
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, table_name);
    RAISE NOTICE 'Dropped policy "%" on %', pol.policyname, table_name;
  END LOOP;

  -- Enable RLS
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

  -- Create optimized policies
  FOREACH act IN ARRAY actions LOOP
    policy_name := table_name || '_' || lower(act);

    IF act = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)',
        policy_name, table_name
      );
    ELSIF act = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)',
        policy_name, table_name
      );
    ELSIF act = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)',
        policy_name, table_name
      );
    ELSIF act = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)',
        policy_name, table_name
      );
    END IF;

    RAISE NOTICE 'Created policy "%" on %', policy_name, table_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Apply to each table (skips if table doesn't exist)
-- ============================================================

DO $$ BEGIN
  PERFORM _fix_rls_for_table('products');
  RAISE NOTICE '--- products: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- products: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('prices');
  RAISE NOTICE '--- prices: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- prices: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('product_categories');
  RAISE NOTICE '--- product_categories: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- product_categories: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('product_images');
  RAISE NOTICE '--- product_images: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- product_images: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('product_urls');
  RAISE NOTICE '--- product_urls: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- product_urls: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('price_check_logs', ARRAY['SELECT','INSERT','UPDATE']);
  RAISE NOTICE '--- price_check_logs: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- price_check_logs: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('price_change_logs', ARRAY['SELECT','INSERT']);
  RAISE NOTICE '--- price_change_logs: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- price_change_logs: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('brands');
  RAISE NOTICE '--- brands: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- brands: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('competitor_products');
  RAISE NOTICE '--- competitor_products: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- competitor_products: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('competitor_prices');
  RAISE NOTICE '--- competitor_prices: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- competitor_prices: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('competitor_product_urls');
  RAISE NOTICE '--- competitor_product_urls: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- competitor_product_urls: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('retailer_skus');
  RAISE NOTICE '--- retailer_skus: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- retailer_skus: table does not exist, skipping ---';
END $$;

DO $$ BEGIN
  PERFORM _fix_rls_for_table('price_check_reminders');
  RAISE NOTICE '--- price_check_reminders: done ---';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE '--- price_check_reminders: table does not exist, skipping ---';
END $$;


-- Clean up the helper function
DROP FUNCTION _fix_rls_for_table(TEXT, TEXT[]);

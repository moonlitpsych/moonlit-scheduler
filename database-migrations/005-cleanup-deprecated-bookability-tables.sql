-- ============================================================================
-- CLEANUP MIGRATION: Remove deprecated bookability tables/views
-- Date: October 7, 2025
-- Purpose: Clean up obsolete bookability tables now that trigger uses canonical view
-- ============================================================================
--
-- PREREQUISITE: Run ONLY after confirming booking works with canonical view
--
-- This migration removes:
-- 1. bookable_provider_payers_v2 and its materialized view variant
-- 2. Deprecated v3 views that were never used
-- 3. Associated refresh functions
--
-- ============================================================================

-- Drop materialized view first (it may depend on the view)
DROP MATERIALIZED VIEW IF EXISTS bookable_provider_payers_v2_mv CASCADE;

-- Drop the refresh function for the materialized view
DROP FUNCTION IF EXISTS refresh_bookable_provider_payers_v2(boolean);

-- Drop the v2 view (main deprecated view)
DROP VIEW IF EXISTS bookable_provider_payers_v2 CASCADE;

-- Drop the source view (it's also a view, not a table)
DROP VIEW IF EXISTS bookable_provider_payers_v2_src CASCADE;

-- Drop explicitly deprecated v3 views
DROP VIEW IF EXISTS v_bookable_provider_payers_v3_deprecated CASCADE;
DROP VIEW IF EXISTS v_bookable_provider_payer_v3 CASCADE;

-- Verify cleanup - show remaining bookability views
SELECT
    schemaname,
    viewname,
    viewowner
FROM pg_views
WHERE viewname LIKE '%bookable%'
ORDER BY viewname;

-- Expected remaining views:
-- - v_bookable_provider_payer (canonical - source of truth)
-- - v_bookable_provider_payer_corrected (if used by admin dashboard)
-- - v_bookable_provider_payer_named (if used)
-- - v_bookable_provider_payer_fixed (investigate if needed)
-- - v_in_network_bookable (investigate if needed)

-- ============================================================================
-- CLEANUP COMPLETE!
-- ============================================================================

-- Migration: Lock down admin-only RPC function permissions
-- Date: October 8, 2025
-- Purpose: Ensure upsert_provider_payer_contract and fn_bookable_provider_payer_asof
--          can only be called by service_role (admin API), not by regular authenticated users

-- ============================================================================
-- Step 1: Revoke public/authenticated access to UPSERT function
-- ============================================================================

REVOKE EXECUTE ON FUNCTION upsert_provider_payer_contract(uuid,uuid,date,date,text,text)
FROM PUBLIC, authenticated;

-- Grant only to service_role (used by admin API)
GRANT EXECUTE ON FUNCTION upsert_provider_payer_contract(uuid,uuid,date,date,text,text)
TO service_role;

-- ============================================================================
-- Step 2: Lock down bookability-as-of-date function (admin Coverage API only)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION fn_bookable_provider_payer_asof(date)
FROM PUBLIC, authenticated;

-- Grant only to service_role (used by admin bookability API)
GRANT EXECUTE ON FUNCTION fn_bookable_provider_payer_asof(date)
TO service_role;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check function permissions (should show only service_role)
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN ('upsert_provider_payer_contract', 'fn_bookable_provider_payer_asof')
ORDER BY routine_name, grantee;

-- Expected result:
-- upsert_provider_payer_contract | service_role | EXECUTE
-- fn_bookable_provider_payer_asof | service_role | EXECUTE

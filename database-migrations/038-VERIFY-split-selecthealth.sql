-- Verification Queries for Migration 038: SelectHealth Payer Split
-- Purpose: Comprehensive verification of Medicaid/Commercial payer separation
-- Date: 2025-11-11
-- Author: Claude Code
--
-- RUN THESE QUERIES AFTER migration 038 to verify everything worked correctly

-- ============================================================================
-- SECTION 1: PAYER VERIFICATION
-- ============================================================================

\echo ''
\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 1: Verify Payer Configuration                                 ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 1.1: Verify both payers exist with correct metadata
\echo '1.1 - Payer Metadata:'
SELECT
    id,
    name,
    payer_type,
    state,
    effective_date,
    requires_attending,
    requires_individual_contract,
    created_at
FROM payers
WHERE name ILIKE '%selecthealth%'
ORDER BY payer_type DESC NULLS LAST, name;

-- Expected Results:
-- Row 1: SelectHealth | Private | UT | ... (Commercial)
-- Row 2: SelectHealth Integrated | Medicaid | UT | ... (Medicaid)

\echo ''

-- Query 1.2: Check for any duplicate SelectHealth payers
\echo '1.2 - Check for Duplicates (should return 0 rows):'
SELECT name, payer_type, COUNT(*) as count
FROM payers
WHERE name ILIKE '%selecthealth%'
GROUP BY name, payer_type
HAVING COUNT(*) > 1;

-- Expected: 0 rows

\echo ''

-- ============================================================================
-- SECTION 2: PLAN DISTRIBUTION VERIFICATION
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 2: Verify Plan Distribution                                   ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 2.1: Plan distribution by payer
\echo '2.1 - Plan Distribution:'
SELECT
    p.name as payer_name,
    p.payer_type,
    pp.plan_name,
    pp.plan_type,
    pp.acceptance_status,
    pp.is_active,
    pp.effective_date
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
ORDER BY p.payer_type DESC NULLS LAST, pp.plan_name;

-- Expected Results:
-- SelectHealth (Private): 5 plans (Choice, Care, Med, Value, Share)
-- SelectHealth Integrated (Medicaid): 1 plan (Select Access)

\echo ''

-- Query 2.2: Plan count summary
\echo '2.2 - Plan Count Summary:'
SELECT
    p.name as payer_name,
    p.payer_type,
    COUNT(pp.id) as plan_count,
    STRING_AGG(pp.plan_name, ', ' ORDER BY pp.plan_name) as plans
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
GROUP BY p.id, p.name, p.payer_type
ORDER BY p.payer_type DESC NULLS LAST;

-- Expected:
-- SelectHealth | Private | 5 | Select Care, Select Choice, Select Med, Select Value, SelectHealth Share
-- SelectHealth Integrated | Medicaid | 1 | Select Access

\echo ''

-- Query 2.3: Acceptance status distribution
\echo '2.3 - Acceptance Status Breakdown:'
SELECT
    p.name as payer_name,
    pp.acceptance_status,
    COUNT(*) as count,
    STRING_AGG(pp.plan_name, ', ' ORDER BY pp.plan_name) as plans
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
GROUP BY p.name, pp.acceptance_status
ORDER BY p.name, pp.acceptance_status;

-- Expected: All plans should have 'in_network' status

\echo ''

-- ============================================================================
-- SECTION 3: PLAN ALIASES VERIFICATION
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 3: Verify Plan Aliases                                        ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 3.1: Verify aliases moved correctly with plans
\echo '3.1 - Plan Aliases by Payer:'
SELECT
    p.name as payer_name,
    pp.plan_name,
    COUNT(ppa.id) as alias_count,
    STRING_AGG(ppa.alias_string, ', ' ORDER BY ppa.priority DESC) as aliases
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
LEFT JOIN payer_plan_aliases ppa ON ppa.plan_id = pp.id
WHERE p.name ILIKE '%selecthealth%'
GROUP BY p.name, pp.plan_name
ORDER BY p.name, pp.plan_name;

-- Expected: Each plan should have 3-4 aliases

\echo ''

-- Query 3.2: Check for orphaned aliases (should be 0)
\echo '3.2 - Orphaned Aliases (should return 0 rows):'
SELECT
    ppa.id,
    ppa.alias_string,
    ppa.plan_id as orphaned_plan_id
FROM payer_plan_aliases ppa
WHERE NOT EXISTS (
    SELECT 1 FROM payer_plans pp WHERE pp.id = ppa.plan_id
)
AND ppa.alias_string ILIKE '%selecthealth%';

-- Expected: 0 rows

\echo ''

-- ============================================================================
-- SECTION 4: OFFICE ALLY CONFIGURATION
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 4: Verify Office Ally Configuration                           ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 4.1: Office Ally payer IDs
\echo '4.1 - Office Ally Configuration:'
SELECT
    p.name as payer_name,
    p.payer_type,
    poac.office_ally_payer_id,
    poac.payer_display_name,
    poac.updated_at
FROM payer_office_ally_configs poac
JOIN payers p ON poac.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
ORDER BY p.payer_type DESC NULLS LAST;

-- Expected: 2 rows with DIFFERENT office_ally_payer_id values
-- ⚠️  If both have same ID or either is NULL, MIGRATION FAILED

\echo ''

-- Query 4.2: Check for missing Office Ally configs
\echo '4.2 - Payers Missing Office Ally Config (should return 0 rows):'
SELECT
    p.id,
    p.name,
    p.payer_type
FROM payers p
WHERE p.name ILIKE '%selecthealth%'
  AND NOT EXISTS (
      SELECT 1 FROM payer_office_ally_configs poac
      WHERE poac.payer_id = p.id
  );

-- Expected: 0 rows (both payers should have Office Ally configs)

\echo ''

-- ============================================================================
-- SECTION 5: PROVIDER CONTRACTS
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 5: Verify Provider Contracts                                  ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 5.1: Contract distribution by payer
\echo '5.1 - Provider Contracts by Payer:'
SELECT
    p.name as payer_name,
    p.payer_type,
    COUNT(DISTINCT ppc.provider_id) as provider_count,
    COUNT(ppc.id) as contract_count,
    STRING_AGG(DISTINCT ppc.network_status, ', ') as network_statuses
FROM provider_payer_contracts ppc
JOIN payers p ON ppc.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
  AND ppc.is_active = TRUE
GROUP BY p.id, p.name, p.payer_type
ORDER BY p.payer_type DESC NULLS LAST;

-- Expected: Both payers should have SAME number of providers/contracts

\echo ''

-- Query 5.2: Verify cloned contracts have notes
\echo '5.2 - Cloned Contract Verification:'
SELECT
    p.name as payer_name,
    pr.first_name || ' ' || pr.last_name as provider_name,
    ppc.network_status,
    ppc.effective_date,
    CASE
        WHEN ppc.notes ILIKE '%cloned%' OR ppc.notes ILIKE '%auto-generated%' THEN 'Cloned'
        ELSE 'Original'
    END as contract_origin
FROM provider_payer_contracts ppc
JOIN payers p ON ppc.payer_id = p.id
JOIN providers pr ON ppc.provider_id = pr.id
WHERE p.name = 'SelectHealth' AND p.payer_type = 'Private'
  AND ppc.is_active = TRUE
ORDER BY pr.last_name;

-- Expected: All contracts for commercial payer should show 'Cloned'

\echo ''

-- Query 5.3: Compare contract counts (Medicaid vs Commercial)
\echo '5.3 - Contract Count Comparison:'
SELECT
    'SelectHealth Integrated (Medicaid)' as payer,
    COUNT(*) as active_contracts
FROM provider_payer_contracts
WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
  AND is_active = TRUE
UNION ALL
SELECT
    'SelectHealth (Commercial)' as payer,
    COUNT(*) as active_contracts
FROM provider_payer_contracts ppc
JOIN payers p ON ppc.payer_id = p.id
WHERE p.name = 'SelectHealth' AND p.payer_type = 'Private'
  AND ppc.is_active = TRUE;

-- Expected: Both should have SAME count

\echo ''

-- ============================================================================
-- SECTION 6: SUPERVISION RELATIONSHIPS
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 6: Verify Supervision Relationships                           ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 6.1: Supervision relationships by payer
\echo '6.1 - Supervision Relationships:'
SELECT
    p.name as payer_name,
    supervised.first_name || ' ' || supervised.last_name as supervised_provider,
    supervising.first_name || ' ' || supervising.last_name as supervising_provider,
    ps.supervision_type,
    ps.is_active,
    ps.effective_date,
    ps.expiration_date
FROM provider_supervisions ps
JOIN payers p ON ps.payer_id = p.id
JOIN providers supervised ON ps.supervised_provider_id = supervised.id
JOIN providers supervising ON ps.supervising_provider_id = supervising.id
WHERE p.name ILIKE '%selecthealth%'
  AND ps.is_active = TRUE
ORDER BY p.name, supervised.last_name;

-- If 0 rows: No supervision relationships exist (OK)
-- If >0 rows: Both payers should have matching supervisions

\echo ''

-- ============================================================================
-- SECTION 7: BOOKABILITY VERIFICATION
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 7: Verify Bookability (CRITICAL TEST)                         ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 7.1: Check v_bookable_provider_payer view
\echo '7.1 - Bookable Providers by SelectHealth Payer:'
SELECT
    payer_name,
    provider_name,
    network_status,
    contract_effective_date,
    contract_expiration_date
FROM v_bookable_provider_payer
WHERE payer_name ILIKE '%selecthealth%'
ORDER BY payer_name, provider_name;

-- Expected: Providers should appear for BOTH payers (Medicaid and Commercial)
-- ⚠️  If providers only show for one payer, MIGRATION FAILED

\echo ''

-- Query 7.2: Count bookable providers per payer
\echo '7.2 - Bookable Provider Count:'
SELECT
    payer_name,
    COUNT(DISTINCT provider_id) as bookable_provider_count
FROM v_bookable_provider_payer
WHERE payer_name ILIKE '%selecthealth%'
GROUP BY payer_name
ORDER BY payer_name;

-- Expected: Both payers should have SAME count

\echo ''

-- ============================================================================
-- SECTION 8: DATA INTEGRITY CHECKS
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 8: Data Integrity Checks                                      ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 8.1: Check for orphaned data in payer_plan_routing_ids
\echo '8.1 - Orphaned Routing IDs (should return 0 rows):'
SELECT
    ppri.id,
    ppri.plan_id as orphaned_plan_id,
    ppri.clearinghouse,
    ppri.routing_id
FROM payer_plan_routing_ids ppri
WHERE NOT EXISTS (
    SELECT 1 FROM payer_plans pp WHERE pp.id = ppri.plan_id
);

-- Expected: 0 rows

\echo ''

-- Query 8.2: Check for plans without acceptance_status
\echo '8.2 - Plans Missing Acceptance Status (should return 0 rows):'
SELECT
    p.name as payer_name,
    pp.plan_name,
    pp.acceptance_status
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
  AND (pp.acceptance_status IS NULL OR pp.acceptance_status = 'unknown');

-- Expected: 0 rows (all plans should have acceptance_status set)

\echo ''

-- Query 8.3: Check for inactive plans
\echo '8.3 - Inactive Plans:'
SELECT
    p.name as payer_name,
    pp.plan_name,
    pp.is_active,
    pp.effective_date,
    pp.expiration_date
FROM payer_plans pp
JOIN payers p ON pp.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
  AND pp.is_active = FALSE;

-- Expected: Verify any inactive plans are intentional

\echo ''

-- ============================================================================
-- SECTION 9: APPOINTMENT IMPACT ANALYSIS
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 9: Verify Existing Appointments (No Changes Expected)         ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Query 9.1: Appointment payer distribution
\echo '9.1 - Appointments by SelectHealth Payer:'
SELECT
    p.name as payer_name,
    p.payer_type,
    COUNT(a.id) as appointment_count,
    MIN(a.start_time) as earliest_appointment,
    MAX(a.start_time) as latest_appointment
FROM appointments a
JOIN payers p ON a.payer_id = p.id
WHERE p.name ILIKE '%selecthealth%'
GROUP BY p.id, p.name, p.payer_type
ORDER BY p.payer_type DESC NULLS LAST;

-- Expected: ALL appointments should remain with SelectHealth Integrated (Medicaid)
-- Commercial payer should have 0 appointments

\echo ''

-- Query 9.2: Recent appointments detail
\echo '9.2 - Recent SelectHealth Appointments (last 30 days):'
SELECT
    a.id,
    a.start_time,
    p.name as payer_name,
    pr.first_name || ' ' || pr.last_name as provider_name,
    a.status
FROM appointments a
JOIN payers p ON a.payer_id = p.id
JOIN providers pr ON a.provider_id = pr.id
WHERE p.name ILIKE '%selecthealth%'
  AND a.start_time >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY a.start_time DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- SECTION 10: API ENDPOINT TEST QUERIES
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  SECTION 10: API Endpoint Verification (Manual Tests Required)         ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- Get payer IDs for API testing
\echo '10.1 - Payer IDs for API Testing:'
SELECT
    name,
    payer_type,
    id as payer_id,
    '🔗 GET /api/payer-plans/' || id as api_endpoint
FROM payers
WHERE name ILIKE '%selecthealth%'
ORDER BY payer_type DESC NULLS LAST;

\echo ''
\echo 'Manual API Tests to Run:'
\echo '1. Test plan display for SelectHealth Integrated (Medicaid)'
\echo '   GET /api/payer-plans/d37d3938-b48d-4bdf-b500-bf5413157ef4'
\echo '   Expected: 1 accepted plan (Select Access), 0 not accepted'
\echo ''
\echo '2. Test plan display for SelectHealth (Commercial)'
\echo '   GET /api/payer-plans/[commercial-payer-id]'
\echo '   Expected: 5 accepted plans (Choice, Care, Med, Value, Share), 0 not accepted'
\echo ''
\echo '3. Test booking flow'
\echo '   - Navigate to /book-dev'
\echo '   - Should see TWO separate SelectHealth payers in search'
\echo '   - SelectHealth Integrated: Shows "Select Access" only'
\echo '   - SelectHealth: Shows 5 commercial plans'
\echo ''
\echo '4. Test ways-to-pay page'
\echo '   - Navigate to /ways-to-pay'
\echo '   - Should see TWO separate SelectHealth cards'
\echo '   - Verify inline plan display shows correct plans for each'
\echo ''
\echo '5. Test eligibility check (Office Ally)'
\echo '   - Run eligibility check for SelectHealth Integrated'
\echo '   - Run eligibility check for SelectHealth Commercial'
\echo '   - Both should succeed with correct Office Ally payer IDs'
\echo ''

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║  VERIFICATION COMPLETE                                                  ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''
\echo '✅ If all queries returned expected results, migration was successful!'
\echo '⚠️  If any query showed unexpected results, investigate before proceeding'
\echo '🔄 Rollback available: 038-ROLLBACK-split-selecthealth.sql'
\echo ''

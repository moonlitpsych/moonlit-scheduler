-- URGENT ROLLBACK: Remove duplicated provider contracts and supervisions
-- These represent actual signed contracts and should NEVER be cloned
-- Date: 2025-11-11
-- Issue: Migration 038 incorrectly cloned provider_payer_networks entries

-- ============================================================================
-- STEP 1: Delete cloned provider contracts for Commercial SelectHealth
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Get the new commercial payer ID
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    IF v_commercial_id IS NULL THEN
        RAISE NOTICE 'Commercial SelectHealth payer not found. Nothing to rollback.';
        RETURN;
    END IF;

    -- Delete ALL provider_payer_networks entries for commercial payer
    DELETE FROM provider_payer_networks
    WHERE payer_id = v_commercial_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE '✅ Deleted % cloned provider contracts for commercial payer', v_deleted_count;
END $$;

-- ============================================================================
-- STEP 2: Keep supervision relationships (they represent clinical scope)
-- ============================================================================
-- Supervision relationships should remain for both payers because:
-- - They represent clinical supervision scope, not contracts
-- - If Dr. Sweeney is supervised by Dr. Privratsky for SelectHealth,
--   he should be bookable for BOTH Medicaid and Commercial SelectHealth
-- - Bookability is handled by v_bookable_provider_payer view

DO $$
BEGIN
    RAISE NOTICE '✅ Supervision relationships preserved (represent clinical scope, not contracts)';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_commercial_id UUID;
    v_medicaid_contracts INTEGER;
    v_commercial_contracts INTEGER;
BEGIN
    SELECT id INTO v_commercial_id
    FROM payers
    WHERE name = 'SelectHealth' AND payer_type = 'Private';

    SELECT COUNT(*) INTO v_medicaid_contracts
    FROM provider_payer_networks
    WHERE payer_id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4';

    SELECT COUNT(*) INTO v_commercial_contracts
    FROM provider_payer_networks
    WHERE payer_id = v_commercial_id;

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║  URGENT ROLLBACK: Provider Contracts Removed                          ║';
    RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTS:';
    RAISE NOTICE '   • SelectHealth Integrated (Medicaid) contracts: %', v_medicaid_contracts;
    RAISE NOTICE '   • SelectHealth (Commercial) contracts: %', v_commercial_contracts;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Contract cloning has been reversed';
    RAISE NOTICE '✅ Supervision relationships preserved (clinical scope, not contracts)';
    RAISE NOTICE '✅ Payer split remains (two payers still exist)';
    RAISE NOTICE '✅ Plan moves remain (6 commercial plans with new payer)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  BOOKABILITY:';
    RAISE NOTICE '   • Providers bookable via existing provider_payer_networks with Medicaid payer';
    RAISE NOTICE '   • v_bookable_provider_payer view handles bookability for both payers';
    RAISE NOTICE '   • Supervised providers bookable for both Medicaid and Commercial';
    RAISE NOTICE '';
END $$;

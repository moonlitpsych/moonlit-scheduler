-- Migration 067: Seed IntakeQ Location IDs for Payers
-- Purpose: Map payers to their IntakeQ booking widget location IDs
-- Context: Enables /book-now to redirect to correct IntakeQ widget per payer
-- Date: 2025-11-12
-- Source: Payer mapping CSV provided by Miriam

-- ============================================================================
-- INTAKEQ LOCATION MAPPINGS
-- ============================================================================
-- IntakeQ Account ID (constant): 673cd162794661bc66f3cad1
--
-- Location mappings from PracticeQ widget configuration:
--
-- locationId=1:  Out-of-pocket pay (UT)
-- locationId=7:  SelectHealth (UT)
-- locationId=8:  HMHI BHN (UT)
-- locationId=9:  DMBA (UT)
-- locationId=10: Health Choice Utah (UT) (Medicaid)
-- locationId=11: Optum Commercial Behavioral Health (UT)
-- locationId=12: Regence BlueCross BlueShield (UT)
-- locationId=13: University of Utah Health Plans UUHP (UT)
-- locationId=14: Aetna (UT)
-- locationId=15: Utah Medicaid Fee-for-Service (UT) (Medicaid — TAM)
-- locationId=16: Molina (UT) (Medicaid)
-- locationId=17: First Health Network (UT)
-- locationId=18: MotivHealth (UT)
-- locationId=19: Idaho (ID) Medicaid
-- locationId=20: SelectHealth Medicaid (UT)
-- locationId=21: HealthyU Medicaid (UT)

-- ============================================================================
-- UPDATE PAYERS BY ID
-- ============================================================================
-- Using exact payer IDs from database mapping CSV

DO $$
DECLARE
    v_updated_count INTEGER := 0;
    v_missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Starting IntakeQ location ID seed...';
    RAISE NOTICE '';

    -- Aetna (UT) → locationId=14
    UPDATE payers SET intakeq_location_id = '14'
    WHERE id = 'd5bf8ae0-9670-49b8-8a3a-b66b82aa1ba2'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Aetna (UT) → locationId=14';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Aetna (UT) not found in database';
    END IF;

    -- DMBA (UT) → locationId=9
    UPDATE payers SET intakeq_location_id = '9'
    WHERE id = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ DMBA (UT) → locationId=9';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  DMBA (UT) not found in database';
    END IF;

    -- First Health Network (UT) → locationId=17
    UPDATE payers SET intakeq_location_id = '17'
    WHERE id = '29e7aa03-6afc-48b0-8d80-50a596aa3565'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ First Health Network (UT) → locationId=17';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  First Health Network (UT) not found in database';
    END IF;

    -- Health Choice Utah (UT) (Medicaid) → locationId=10
    UPDATE payers SET intakeq_location_id = '10'
    WHERE id = '62ab291d-b68e-4c71-a093-2d6e380764c3'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Health Choice Utah (UT) (Medicaid) → locationId=10';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Health Choice Utah (UT) (Medicaid) not found in database';
    END IF;

    -- HMHI BHN (UT) → locationId=8
    UPDATE payers SET intakeq_location_id = '8'
    WHERE id = '2db7c014-8674-40bb-b918-88160ffde0a6'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ HMHI BHN (UT) → locationId=8';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  HMHI BHN (UT) not found in database';
    END IF;

    -- Idaho (ID) Medicaid → locationId=19
    UPDATE payers SET intakeq_location_id = '19'
    WHERE id = 'e66daffe-8444-43e0-908c-c366c5d38ef7'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Idaho (ID) Medicaid → locationId=19';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Idaho (ID) Medicaid not found in database';
    END IF;

    -- Molina (UT) (Medicaid) → locationId=16
    UPDATE payers SET intakeq_location_id = '16'
    WHERE id = '8b48c3e2-f555-4d67-8122-c086466ba97d'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Molina (UT) (Medicaid) → locationId=16';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Molina (UT) (Medicaid) not found in database';
    END IF;

    -- MotivHealth (UT) → locationId=18
    UPDATE payers SET intakeq_location_id = '18'
    WHERE id = '1f9c18ec-f4af-4343-9c1f-515abda9c442'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ MotivHealth (UT) → locationId=18';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  MotivHealth (UT) not found in database';
    END IF;

    -- Optum Commercial Behavioral Health (UT) → locationId=11
    UPDATE payers SET intakeq_location_id = '11'
    WHERE id = 'c9a7e516-4498-4e21-8f7c-b359653d2d69'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Optum Commercial Behavioral Health (UT) → locationId=11';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Optum Commercial Behavioral Health (UT) not found in database';
    END IF;

    -- Out-of-pocket pay (UT) → locationId=1
    UPDATE payers SET intakeq_location_id = '1'
    WHERE id = '6317e5c7-e3fb-48ed-a394-db7a8b94b206'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Out-of-pocket pay (UT) → locationId=1';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Out-of-pocket pay (UT) not found in database';
    END IF;

    -- Regence BlueCross BlueShield (UT) → locationId=12
    UPDATE payers SET intakeq_location_id = '12'
    WHERE id = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Regence BlueCross BlueShield (UT) → locationId=12';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Regence BlueCross BlueShield (UT) not found in database';
    END IF;

    -- SelectHealth (UT) → locationId=7
    UPDATE payers SET intakeq_location_id = '7'
    WHERE id = 'e0a05389-7890-43bc-8153-f6596019351e'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ SelectHealth (UT) → locationId=7';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  SelectHealth (UT) not found in database';
    END IF;

    -- University of Utah Health Plans UUHP (UT) → locationId=13
    UPDATE payers SET intakeq_location_id = '13'
    WHERE id = 'c238fcff-dd31-4be8-a0b2-292c0800d9c4'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ University of Utah Health Plans UUHP (UT) → locationId=13';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  University of Utah Health Plans UUHP (UT) not found in database';
    END IF;

    -- Utah Medicaid Fee-for-Service (UT) (Medicaid — TAM) → locationId=15
    UPDATE payers SET intakeq_location_id = '15'
    WHERE id = 'a01d69d6-ae70-4917-afef-49b5ef7e5220'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ Utah Medicaid Fee-for-Service (UT) → locationId=15';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  Utah Medicaid Fee-for-Service (UT) not found in database';
    END IF;

    -- HealthyU Medicaid (UT) → locationId=21
    UPDATE payers SET intakeq_location_id = '21'
    WHERE id = 'd218f12b-f8c4-498e-96c4-a03693c322d2'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ HealthyU Medicaid (UT) → locationId=21';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  HealthyU Medicaid (UT) not found in database';
    END IF;

    -- SelectHealth Medicaid (UT) → locationId=20
    UPDATE payers SET intakeq_location_id = '20'
    WHERE id = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'::uuid;
    IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        RAISE NOTICE '✅ SelectHealth Medicaid (UT) → locationId=20';
    ELSE
        v_missing_count := v_missing_count + 1;
        RAISE NOTICE '⚠️  SelectHealth Medicaid (UT) not found in database';
    END IF;

    -- Summary
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 067 complete: IntakeQ location IDs seeded';
    RAISE NOTICE '   Payers updated: %', v_updated_count;
    IF v_missing_count > 0 THEN
        RAISE NOTICE '   ⚠️  Payers not found: %', v_missing_count;
    END IF;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all payers with location IDs
SELECT
    name,
    state,
    status_code,
    intakeq_location_id as location_id,
    effective_date
FROM payers
WHERE intakeq_location_id IS NOT NULL
ORDER BY
    CASE
        WHEN intakeq_location_id = '1' THEN 1  -- Self-pay first
        ELSE 2
    END,
    state,
    name;

-- Summary stats
SELECT
    COUNT(*) FILTER (WHERE intakeq_location_id IS NOT NULL) as payers_with_location,
    COUNT(*) FILTER (WHERE status_code = 'approved') as total_approved_payers,
    COUNT(*) as total_payers
FROM payers;

-- ============================================================================
-- NOTES
-- ============================================================================
-- All 16 payers from the mapping CSV have been seeded with their location IDs.
-- If any payers show as "not found", the payer ID may have changed in the database.
-- To add new payers in the future, add similar UPDATE statements above.

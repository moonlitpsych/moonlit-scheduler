-- Migration 033: Add SelectHealth Contract Plans (Real Data Only)
-- Purpose: Add the 6 SelectHealth plans from Dr. Privratsky's actual signed contract
-- Context: Extracted from Select_Health_Contract_for_Anthony_Privratsky_signed.pdf
--          Contract signed: 10/13/2025
--          Appendices define accepted insurance products
-- Date: 2025-10-31
--
-- DATA SOURCE: /Users/miriam/Downloads/Select_Health_Contract_for_Anthony_Privratsky_signed.pdf
-- Pages 23-36 list the specific SelectHealth products covered by this contract

-- ============================================================================
-- SELECTHEALTH PLANS (FROM ACTUAL CONTRACT)
-- ============================================================================

DO $$
DECLARE
    v_selecthealth_id UUID;
    v_choice_plan_id UUID;
    v_care_plan_id UUID;
    v_med_plan_id UUID;
    v_value_plan_id UUID;
    v_share_plan_id UUID;
    v_access_plan_id UUID;
BEGIN
    -- Get SelectHealth payer ID
    SELECT id INTO v_selecthealth_id
    FROM payers
    WHERE name ILIKE '%selecthealth%'
    LIMIT 1;

    IF v_selecthealth_id IS NULL THEN
        RAISE EXCEPTION 'SelectHealth payer not found in database. Add payer first.';
    END IF;

    RAISE NOTICE 'Found SelectHealth payer: %', v_selecthealth_id;

    -- ========================================================================
    -- PLAN 1: Select Choice® (Contract pages 23-24)
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'Select Choice',
        'PPO',
        TRUE,  -- Default plan for SelectHealth
        TRUE,
        '2025-10-13',  -- Contract effective date
        'From Dr. Privratsky contract, pages 23-24. Standard SelectHealth product.'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_choice_plan_id;

    -- ========================================================================
    -- PLAN 2: Select Care® (Contract pages 25-26)
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'Select Care',
        'PPO',
        FALSE,
        TRUE,
        '2025-10-13',
        'From Dr. Privratsky contract, pages 25-26'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_care_plan_id;

    -- ========================================================================
    -- PLAN 3: Select Med® (Contract pages 27-28)
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'Select Med',
        'PPO',
        FALSE,
        TRUE,
        '2025-10-13',
        'From Dr. Privratsky contract, pages 27-28'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_med_plan_id;

    -- ========================================================================
    -- PLAN 4: Select Value® (Contract page 29)
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'Select Value',
        'HMO',
        FALSE,
        TRUE,
        '2025-10-13',
        'From Dr. Privratsky contract, page 29'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_value_plan_id;

    -- ========================================================================
    -- PLAN 5: SelectHealth Share® (Contract pages 30-31)
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'SelectHealth Share',
        'PPO',
        FALSE,
        TRUE,
        '2025-10-13',
        'From Dr. Privratsky contract, pages 30-31. Health sharing product.'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_share_plan_id;

    -- ========================================================================
    -- PLAN 6: Select Access® (Contract pages 32-36) - Medicaid/CHIP
    -- ========================================================================
    INSERT INTO payer_plans (
        payer_id,
        plan_name,
        plan_type,
        is_default,
        is_active,
        effective_date,
        notes
    )
    VALUES (
        v_selecthealth_id,
        'Select Access',
        'Medicaid',
        FALSE,
        TRUE,
        '2025-10-13',
        'From Dr. Privratsky contract, pages 32-36. Medicaid/CHIP product.'
    )
    ON CONFLICT (payer_id, plan_name) DO UPDATE
    SET notes = EXCLUDED.notes
    RETURNING id INTO v_access_plan_id;

    -- ========================================================================
    -- ADD COMMON ALIASES FOR PLAN MATCHING
    -- ========================================================================

    -- Select Choice aliases
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_choice_plan_id, 'SelectHealth Choice', 'insurance_card', 100, TRUE),
        (v_choice_plan_id, 'Select Choice', 'insurance_card', 100, TRUE),
        (v_choice_plan_id, 'SELECTHEALTH CHOICE', '271_response', 90, TRUE),
        (v_choice_plan_id, 'CHOICE', '271_response', 70, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Select Care aliases
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_care_plan_id, 'SelectHealth Care', 'insurance_card', 100, TRUE),
        (v_care_plan_id, 'Select Care', 'insurance_card', 100, TRUE),
        (v_care_plan_id, 'SELECTHEALTH CARE', '271_response', 90, TRUE),
        (v_care_plan_id, 'CARE', '271_response', 70, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Select Med aliases
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_med_plan_id, 'SelectHealth Med', 'insurance_card', 100, TRUE),
        (v_med_plan_id, 'Select Med', 'insurance_card', 100, TRUE),
        (v_med_plan_id, 'SELECTHEALTH MED', '271_response', 90, TRUE),
        (v_med_plan_id, 'MED', '271_response', 70, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Select Value aliases
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_value_plan_id, 'SelectHealth Value', 'insurance_card', 100, TRUE),
        (v_value_plan_id, 'Select Value', 'insurance_card', 100, TRUE),
        (v_value_plan_id, 'SELECTHEALTH VALUE', '271_response', 90, TRUE),
        (v_value_plan_id, 'VALUE', '271_response', 70, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- SelectHealth Share aliases
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_share_plan_id, 'SelectHealth Share', 'insurance_card', 100, TRUE),
        (v_share_plan_id, 'SELECTHEALTH SHARE', '271_response', 90, TRUE),
        (v_share_plan_id, 'SHARE', '271_response', 70, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Select Access aliases (Medicaid/CHIP)
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_access_plan_id, 'SelectHealth Access', 'insurance_card', 100, TRUE),
        (v_access_plan_id, 'Select Access', 'insurance_card', 100, TRUE),
        (v_access_plan_id, 'SELECTHEALTH ACCESS', '271_response', 90, TRUE),
        (v_access_plan_id, 'ACCESS', '271_response', 70, TRUE),
        (v_access_plan_id, 'SelectHealth Medicaid', 'insurance_card', 85, TRUE),
        (v_access_plan_id, 'SelectHealth CHIP', 'insurance_card', 85, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 033 complete: SelectHealth contract plans added';
    RAISE NOTICE '   Plans created: 6 (from actual contract)';
    RAISE NOTICE '   Data source: Dr. Privratsky SelectHealth contract (signed 10/13/2025)';
    RAISE NOTICE '   Contract pages: 23-36 (appendices)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Populate provider_payer_accepted_plans junction table';
END $$;

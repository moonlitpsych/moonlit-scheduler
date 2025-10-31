-- Migration 026: Seed Networks and Plans for Big 3 Payers
-- Purpose: Add network/plan data for Regence, SelectHealth, and Aetna
-- Context: These payers have multiple sub-networks causing booking errors
-- Date: 2025-10-31

-- ============================================================================
-- IMPORTANT: RUN THIS AFTER VERIFYING PAYER NAMES
-- ============================================================================
-- This script looks up payers by name. If your payer names don't match exactly,
-- update the WHERE clauses below (e.g., 'Regence%', 'SelectHealth%', 'Aetna%')

-- ============================================================================
-- HELPER: Get or Create Functions
-- ============================================================================

-- Function to get payer_id by name (case-insensitive, wildcard)
CREATE OR REPLACE FUNCTION get_payer_id_by_name(p_name_pattern TEXT)
RETURNS UUID AS $$
DECLARE
    v_payer_id UUID;
BEGIN
    SELECT id INTO v_payer_id
    FROM payers
    WHERE name ILIKE p_name_pattern
    LIMIT 1;

    IF v_payer_id IS NULL THEN
        RAISE NOTICE 'Warning: No payer found matching pattern: %', p_name_pattern;
    END IF;

    RETURN v_payer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REGENCE BCBS NETWORKS AND PLANS
-- ============================================================================

DO $$
DECLARE
    v_regence_id UUID;
    v_bhpn_network_id UUID;
    v_traditional_network_id UUID;
    v_ppo_plan_id UUID;
    v_hmo_plan_id UUID;
BEGIN
    -- Get Regence payer ID
    v_regence_id := get_payer_id_by_name('%regence%');

    IF v_regence_id IS NULL THEN
        RAISE NOTICE 'Skipping Regence: Payer not found in database';
        RETURN;
    END IF;

    RAISE NOTICE 'Found Regence payer: %', v_regence_id;

    -- Create BHPN Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_regence_id,
        'Regence Behavioral Health Provider Network (BHPN)',
        'BHPN',
        'Specialized behavioral health network with enhanced mental health coverage',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_bhpn_network_id;

    IF v_bhpn_network_id IS NULL THEN
        SELECT id INTO v_bhpn_network_id FROM payer_networks
        WHERE payer_id = v_regence_id AND network_code = 'BHPN';
    END IF;

    -- Create Traditional Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_regence_id,
        'Regence Traditional Network',
        'TRAD',
        'Standard medical and behavioral health network',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_traditional_network_id;

    IF v_traditional_network_id IS NULL THEN
        SELECT id INTO v_traditional_network_id FROM payer_networks
        WHERE payer_id = v_regence_id AND network_code = 'TRAD';
    END IF;

    -- Create PPO Plan (BHPN Network)
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_regence_id,
        v_bhpn_network_id,
        'Regence BlueShield PPO (BHPN)',
        'PPO',
        TRUE,  -- Make this the default for Regence
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_ppo_plan_id;

    IF v_ppo_plan_id IS NULL THEN
        SELECT id INTO v_ppo_plan_id FROM payer_plans
        WHERE payer_id = v_regence_id AND plan_name = 'Regence BlueShield PPO (BHPN)';
    END IF;

    -- Create HMO Plan (Traditional Network)
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_regence_id,
        v_traditional_network_id,
        'Regence BlueShield HMO',
        'HMO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_hmo_plan_id;

    IF v_hmo_plan_id IS NULL THEN
        SELECT id INTO v_hmo_plan_id FROM payer_plans
        WHERE payer_id = v_regence_id AND plan_name = 'Regence BlueShield HMO';
    END IF;

    -- Add common aliases for Regence PPO (BHPN)
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_ppo_plan_id, 'REGENCE BCBS', '271_response', 100, TRUE),
        (v_ppo_plan_id, 'Regence BlueShield', 'insurance_card', 100, TRUE),
        (v_ppo_plan_id, 'REGENCE BLUESHIELD OF UTAH', '271_response', 90, TRUE),
        (v_ppo_plan_id, 'Regence BCBS PPO', 'insurance_card', 85, TRUE),
        (v_ppo_plan_id, 'REGENCE PPO', '271_response', 80, TRUE),
        (v_ppo_plan_id, 'Regence - BHPN', 'manual', 95, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Add common aliases for Regence HMO
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_hmo_plan_id, 'Regence HMO', 'insurance_card', 90, TRUE),
        (v_hmo_plan_id, 'REGENCE BCBS HMO', '271_response', 85, TRUE),
        (v_hmo_plan_id, 'Regence BlueShield HMO', 'insurance_card', 80, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    RAISE NOTICE '✅ Regence: Created % networks and % plans', 2, 2;
END $$;

-- ============================================================================
-- SELECTHEALTH NETWORKS AND PLANS
-- ============================================================================

DO $$
DECLARE
    v_selecthealth_id UUID;
    v_traditional_network_id UUID;
    v_advantage_network_id UUID;
    v_value_network_id UUID;
    v_signature_network_id UUID;
    v_trad_ppo_plan_id UUID;
    v_adv_ppo_plan_id UUID;
    v_value_plan_id UUID;
    v_signature_plan_id UUID;
BEGIN
    -- Get SelectHealth payer ID
    v_selecthealth_id := get_payer_id_by_name('%selecthealth%');

    IF v_selecthealth_id IS NULL THEN
        RAISE NOTICE 'Skipping SelectHealth: Payer not found in database';
        RETURN;
    END IF;

    RAISE NOTICE 'Found SelectHealth payer: %', v_selecthealth_id;

    -- Create Traditional Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_selecthealth_id,
        'SelectHealth Traditional Network',
        'TRAD',
        'Original SelectHealth network with broadest provider access',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_traditional_network_id;

    IF v_traditional_network_id IS NULL THEN
        SELECT id INTO v_traditional_network_id FROM payer_networks
        WHERE payer_id = v_selecthealth_id AND network_code = 'TRAD';
    END IF;

    -- Create Advantage Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_selecthealth_id,
        'SelectHealth Advantage Network',
        'ADV',
        'Narrower network with lower premiums',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_advantage_network_id;

    IF v_advantage_network_id IS NULL THEN
        SELECT id INTO v_advantage_network_id FROM payer_networks
        WHERE payer_id = v_selecthealth_id AND network_code = 'ADV';
    END IF;

    -- Create Value Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_selecthealth_id,
        'SelectHealth Value Network',
        'VALUE',
        'Cost-optimized network for budget-conscious plans',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_value_network_id;

    IF v_value_network_id IS NULL THEN
        SELECT id INTO v_value_network_id FROM payer_networks
        WHERE payer_id = v_selecthealth_id AND network_code = 'VALUE';
    END IF;

    -- Create Signature Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_selecthealth_id,
        'SelectHealth Signature Network',
        'SIG',
        'Premium network with enhanced benefits',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_signature_network_id;

    IF v_signature_network_id IS NULL THEN
        SELECT id INTO v_signature_network_id FROM payer_networks
        WHERE payer_id = v_selecthealth_id AND network_code = 'SIG';
    END IF;

    -- Create Traditional PPO Plan (default)
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_selecthealth_id,
        v_traditional_network_id,
        'SelectHealth Traditional PPO',
        'PPO',
        TRUE,  -- Default plan
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_trad_ppo_plan_id;

    IF v_trad_ppo_plan_id IS NULL THEN
        SELECT id INTO v_trad_ppo_plan_id FROM payer_plans
        WHERE payer_id = v_selecthealth_id AND plan_name = 'SelectHealth Traditional PPO';
    END IF;

    -- Create Advantage PPO Plan
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_selecthealth_id,
        v_advantage_network_id,
        'SelectHealth Advantage PPO',
        'PPO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_adv_ppo_plan_id;

    -- Create Value Plan
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_selecthealth_id,
        v_value_network_id,
        'SelectHealth Value Plan',
        'HMO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING;

    -- Create Signature Plan
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_selecthealth_id,
        v_signature_network_id,
        'SelectHealth Signature Plan',
        'PPO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING;

    -- Add aliases for Traditional plan
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_trad_ppo_plan_id, 'SELECTHEALTH', '271_response', 100, TRUE),
        (v_trad_ppo_plan_id, 'SelectHealth', 'insurance_card', 100, TRUE),
        (v_trad_ppo_plan_id, 'SELECT HEALTH TRAD', '271_response', 90, TRUE),
        (v_trad_ppo_plan_id, 'SelectHealth Traditional', 'insurance_card', 85, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Add aliases for Advantage plan
    IF v_adv_ppo_plan_id IS NOT NULL THEN
        INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
        VALUES
            (v_adv_ppo_plan_id, 'SelectHealth Advantage', 'insurance_card', 90, TRUE),
            (v_adv_ppo_plan_id, 'SELECT HEALTH ADV', '271_response', 85, TRUE),
            (v_adv_ppo_plan_id, 'SelectHealth Adv', 'insurance_card', 80, TRUE)
        ON CONFLICT (alias_string) DO NOTHING;
    END IF;

    RAISE NOTICE '✅ SelectHealth: Created % networks and % plans', 4, 4;
END $$;

-- ============================================================================
-- AETNA NETWORKS AND PLANS
-- ============================================================================

DO $$
DECLARE
    v_aetna_id UUID;
    v_signature_network_id UUID;
    v_choice_network_id UUID;
    v_signature_ppo_plan_id UUID;
    v_choice_ppo_plan_id UUID;
    v_hmo_plan_id UUID;
BEGIN
    -- Get Aetna payer ID
    v_aetna_id := get_payer_id_by_name('%aetna%');

    IF v_aetna_id IS NULL THEN
        RAISE NOTICE 'Skipping Aetna: Payer not found in database';
        RETURN;
    END IF;

    RAISE NOTICE 'Found Aetna payer: %', v_aetna_id;

    -- Create Signature Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_aetna_id,
        'Aetna Signature Network',
        'SIG',
        'Premium network with comprehensive provider access',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_signature_network_id;

    IF v_signature_network_id IS NULL THEN
        SELECT id INTO v_signature_network_id FROM payer_networks
        WHERE payer_id = v_aetna_id AND network_code = 'SIG';
    END IF;

    -- Create Choice Network
    INSERT INTO payer_networks (payer_id, network_name, network_code, description, is_active)
    VALUES (
        v_aetna_id,
        'Aetna Choice Network',
        'CHOICE',
        'Standard network with broad provider coverage',
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_choice_network_id;

    IF v_choice_network_id IS NULL THEN
        SELECT id INTO v_choice_network_id FROM payer_networks
        WHERE payer_id = v_aetna_id AND network_code = 'CHOICE';
    END IF;

    -- Create Signature PPO Plan (default)
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_aetna_id,
        v_signature_network_id,
        'Aetna Signature PPO',
        'PPO',
        TRUE,  -- Default plan
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_signature_ppo_plan_id;

    IF v_signature_ppo_plan_id IS NULL THEN
        SELECT id INTO v_signature_ppo_plan_id FROM payer_plans
        WHERE payer_id = v_aetna_id AND plan_name = 'Aetna Signature PPO';
    END IF;

    -- Create Choice PPO Plan
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_aetna_id,
        v_choice_network_id,
        'Aetna Choice PPO',
        'PPO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_choice_ppo_plan_id;

    -- Create HMO Plan
    INSERT INTO payer_plans (payer_id, network_id, plan_name, plan_type, is_default, is_active)
    VALUES (
        v_aetna_id,
        v_choice_network_id,
        'Aetna HMO',
        'HMO',
        FALSE,
        TRUE
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_hmo_plan_id;

    -- Add aliases for Signature PPO
    INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
    VALUES
        (v_signature_ppo_plan_id, 'AETNA', '271_response', 100, TRUE),
        (v_signature_ppo_plan_id, 'Aetna', 'insurance_card', 100, TRUE),
        (v_signature_ppo_plan_id, 'AETNA SIGNATURE', '271_response', 90, TRUE),
        (v_signature_ppo_plan_id, 'Aetna Signature', 'insurance_card', 85, TRUE),
        (v_signature_ppo_plan_id, 'Aetna PPO', 'insurance_card', 80, TRUE)
    ON CONFLICT (alias_string) DO NOTHING;

    -- Add aliases for Choice PPO
    IF v_choice_ppo_plan_id IS NOT NULL THEN
        INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
        VALUES
            (v_choice_ppo_plan_id, 'Aetna Choice', 'insurance_card', 90, TRUE),
            (v_choice_ppo_plan_id, 'AETNA CHOICE PPO', '271_response', 85, TRUE)
        ON CONFLICT (alias_string) DO NOTHING;
    END IF;

    -- Add aliases for HMO
    IF v_hmo_plan_id IS NOT NULL THEN
        INSERT INTO payer_plan_aliases (plan_id, alias_string, source, priority, is_active)
        VALUES
            (v_hmo_plan_id, 'Aetna HMO', 'insurance_card', 80, TRUE),
            (v_hmo_plan_id, 'AETNA HMO', '271_response', 75, TRUE)
        ON CONFLICT (alias_string) DO NOTHING;
    END IF;

    RAISE NOTICE '✅ Aetna: Created % networks and % plans', 2, 3;
END $$;

-- ============================================================================
-- CLEANUP: Drop helper function
-- ============================================================================

DROP FUNCTION IF EXISTS get_payer_id_by_name(TEXT);

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

DO $$
DECLARE
    v_network_count INTEGER;
    v_plan_count INTEGER;
    v_alias_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_network_count FROM payer_networks;
    SELECT COUNT(*) INTO v_plan_count FROM payer_plans;
    SELECT COUNT(*) INTO v_alias_count FROM payer_plan_aliases;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 026 complete: Big 3 payer networks and plans seeded';
    RAISE NOTICE '   Total networks created: %', v_network_count;
    RAISE NOTICE '   Total plans created: %', v_plan_count;
    RAISE NOTICE '   Total aliases created: %', v_alias_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Review seeded data: SELECT * FROM payer_networks JOIN payers ON payer_networks.payer_id = payers.id;';
    RAISE NOTICE '2. Assign providers to specific networks in provider_payer_networks table';
    RAISE NOTICE '3. Test plan resolution: SELECT * FROM resolve_plan_to_network([payer_id], ''REGENCE BCBS'');';
END $$;

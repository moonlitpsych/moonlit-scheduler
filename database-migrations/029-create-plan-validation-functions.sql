-- Migration 029: Plan Validation Functions (Junction Table Version)
-- Purpose: Resolve plan names and validate provider can accept patient's specific plan
-- Context: Uses provider_payer_accepted_plans junction table
-- Date: 2025-10-31

-- ============================================================================
-- FUNCTION 1: RESOLVE PLAN NAME TO PLAN_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_plan_name_to_id(
    p_payer_id UUID,
    p_plan_string TEXT
)
RETURNS TABLE (
    plan_id UUID,
    plan_name TEXT,
    network_id UUID,
    network_name TEXT,
    confidence TEXT  -- 'high' (exact match), 'medium' (fuzzy match), 'low' (default fallback), 'none' (no match)
) AS $$
BEGIN
    -- STEP 1: Try exact alias match (case-insensitive)
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.plan_name,
        pp.network_id,
        pn.network_name,
        'high'::TEXT AS confidence
    FROM payer_plan_aliases ppa
    JOIN payer_plans pp ON ppa.plan_id = pp.id
    LEFT JOIN payer_networks pn ON pp.network_id = pn.id
    WHERE pp.payer_id = p_payer_id
      AND ppa.alias_string ILIKE p_plan_string
      AND ppa.is_active = TRUE
      AND pp.is_active = TRUE
    ORDER BY ppa.priority DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 2: Try fuzzy match (contains)
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.plan_name,
        pp.network_id,
        pn.network_name,
        'medium'::TEXT AS confidence
    FROM payer_plan_aliases ppa
    JOIN payer_plans pp ON ppa.plan_id = pp.id
    LEFT JOIN payer_networks pn ON pp.network_id = pn.id
    WHERE pp.payer_id = p_payer_id
      AND (
          ppa.alias_string ILIKE '%' || p_plan_string || '%'
          OR p_plan_string ILIKE '%' || ppa.alias_string || '%'
      )
      AND ppa.is_active = TRUE
      AND pp.is_active = TRUE
    ORDER BY ppa.priority DESC, LENGTH(ppa.alias_string) ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 3: Fall back to default plan for this payer
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.plan_name,
        pp.network_id,
        pn.network_name,
        'low'::TEXT AS confidence
    FROM payer_plans pp
    LEFT JOIN payer_networks pn ON pp.network_id = pn.id
    WHERE pp.payer_id = p_payer_id
      AND pp.is_default = TRUE
      AND pp.is_active = TRUE
    ORDER BY pp.effective_date DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 4: No match found
    RETURN QUERY
    SELECT
        NULL::UUID AS plan_id,
        NULL::TEXT AS plan_name,
        NULL::UUID AS network_id,
        NULL::TEXT AS network_name,
        'none'::TEXT AS confidence;

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_plan_name_to_id(UUID, TEXT) IS
'Resolves messy plan string (from insurance card or 271 response) to canonical plan_id.
Returns plan details with confidence level (high/medium/low/none).
Does NOT check provider acceptance - only resolves the plan name.';

-- ============================================================================
-- FUNCTION 2: CHECK IF PROVIDER ACCEPTS SPECIFIC PLAN
-- ============================================================================

CREATE OR REPLACE FUNCTION does_provider_accept_plan(
    p_provider_id UUID,
    p_payer_id UUID,
    p_plan_string TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    accepts_plan BOOLEAN,
    contract_status TEXT,  -- 'direct', 'supervised', 'no_contract', 'plan_not_accepted'
    contract_id UUID,
    billing_provider_id UUID,
    rendering_provider_id UUID,
    plan_id UUID,
    plan_name TEXT,
    confidence TEXT,
    reason TEXT
) AS $$
DECLARE
    v_resolved_plan_id UUID;
    v_resolved_plan_name TEXT;
    v_resolved_network_id UUID;
    v_resolved_network_name TEXT;
    v_confidence TEXT;
BEGIN
    -- STEP 1: Resolve plan string to plan_id
    IF p_plan_string IS NOT NULL AND p_plan_string <> '' THEN
        SELECT
            rpn.plan_id,
            rpn.plan_name,
            rpn.network_id,
            rpn.network_name,
            rpn.confidence
        INTO
            v_resolved_plan_id,
            v_resolved_plan_name,
            v_resolved_network_id,
            v_resolved_network_name,
            v_confidence
        FROM resolve_plan_name_to_id(p_payer_id, p_plan_string) rpn;
    END IF;

    -- STEP 2: Check direct provider contract
    FOR contract_id, accepts_plan, contract_status, billing_provider_id, rendering_provider_id, plan_id, plan_name, confidence, reason IN
        SELECT
            ppn.id AS contract_id,
            CASE
                WHEN v_resolved_plan_id IS NULL THEN TRUE  -- No specific plan, payer-level acceptance
                WHEN ppap.id IS NOT NULL THEN TRUE  -- Contract explicitly accepts this plan
                ELSE FALSE  -- Contract exists but doesn't accept this plan
            END AS accepts_plan,
            'direct'::TEXT AS contract_status,
            NULL::UUID AS billing_provider_id,
            NULL::UUID AS rendering_provider_id,
            v_resolved_plan_id AS plan_id,
            v_resolved_plan_name AS plan_name,
            v_confidence AS confidence,
            CASE
                WHEN v_resolved_plan_id IS NULL THEN 'Provider has contract with payer (no specific plan validation)'
                WHEN ppap.id IS NOT NULL THEN 'Provider contract explicitly accepts ' || v_resolved_plan_name
                ELSE 'Provider has contract with payer but does NOT accept ' || v_resolved_plan_name || ' plan'
            END AS reason
        FROM provider_payer_networks ppn
        LEFT JOIN provider_payer_accepted_plans ppap
            ON ppn.id = ppap.provider_payer_network_id
            AND ppap.plan_id = v_resolved_plan_id
        WHERE ppn.provider_id = p_provider_id
            AND ppn.payer_id = p_payer_id
            AND ppn.status = 'active'
            AND ppn.effective_date <= p_date
            AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
        LIMIT 1
    LOOP
        RETURN NEXT;
        RETURN;
    END LOOP;

    -- STEP 3: Check supervised relationship
    FOR contract_id, accepts_plan, contract_status, billing_provider_id, rendering_provider_id, plan_id, plan_name, confidence, reason IN
        SELECT
            ppn.id AS contract_id,
            CASE
                WHEN v_resolved_plan_id IS NULL THEN TRUE
                WHEN ppap.id IS NOT NULL THEN TRUE
                ELSE FALSE
            END AS accepts_plan,
            'supervised'::TEXT AS contract_status,
            sr.supervisor_provider_id AS billing_provider_id,
            sr.supervisee_provider_id AS rendering_provider_id,
            v_resolved_plan_id AS plan_id,
            v_resolved_plan_name AS plan_name,
            v_confidence AS confidence,
            CASE
                WHEN v_resolved_plan_id IS NULL THEN 'Provider supervised by attending with payer contract (no specific plan validation)'
                WHEN ppap.id IS NOT NULL THEN 'Supervising provider contract accepts ' || v_resolved_plan_name
                ELSE 'Supervising provider contract does NOT accept ' || v_resolved_plan_name || ' plan'
            END AS reason
        FROM supervision_relationships sr
        JOIN provider_payer_networks ppn
            ON sr.supervisor_provider_id = ppn.provider_id
            AND sr.payer_id = ppn.payer_id
        LEFT JOIN provider_payer_accepted_plans ppap
            ON ppn.id = ppap.provider_payer_network_id
            AND ppap.plan_id = v_resolved_plan_id
        WHERE sr.supervisee_provider_id = p_provider_id
            AND sr.payer_id = p_payer_id
            AND sr.is_active = TRUE
            AND sr.start_date <= p_date
            AND (sr.end_date IS NULL OR sr.end_date >= p_date)
            AND ppn.status = 'active'
            AND ppn.effective_date <= p_date
            AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
        LIMIT 1
    LOOP
        RETURN NEXT;
        RETURN;
    END LOOP;

    -- STEP 4: No contract found
    RETURN QUERY
    SELECT
        FALSE AS accepts_plan,
        'no_contract'::TEXT AS contract_status,
        NULL::UUID AS contract_id,
        NULL::UUID AS billing_provider_id,
        NULL::UUID AS rendering_provider_id,
        v_resolved_plan_id AS plan_id,
        v_resolved_plan_name AS plan_name,
        v_confidence AS confidence,
        'Provider has no contract with this payer' AS reason;

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION does_provider_accept_plan(UUID, UUID, TEXT, DATE) IS
'Checks if provider can accept patient with specific plan.
Uses junction table to validate plan acceptance.
If no plan_string provided, does payer-level validation only.
Returns detailed acceptance info including confidence and reason.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname IN (
        'resolve_plan_name_to_id',
        'does_provider_accept_plan'
    )) = 2, 'Expected 2 functions to be created';

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 029 complete: Plan validation functions created';
    RAISE NOTICE '   - resolve_plan_name_to_id(): Maps plan strings to plan_id';
    RAISE NOTICE '   - does_provider_accept_plan(): Validates provider accepts specific plan';
    RAISE NOTICE '';
    RAISE NOTICE 'These functions use provider_payer_accepted_plans junction table';
    RAISE NOTICE 'Next: Update booking trigger to use these functions';
END $$;

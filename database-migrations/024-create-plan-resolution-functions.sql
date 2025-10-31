-- Migration 024: Plan Resolution Helper Functions
-- Purpose: Resolve messy 271/card plan strings to canonical plans and networks
-- Context: Enable booking flow to match patient plans to provider network participation
-- Date: 2025-10-31

-- ============================================================================
-- FUNCTION 1: RESOLVE PLAN NAME TO NETWORK
-- ============================================================================
-- Takes a payer_id and plan string, returns network_id
-- Uses alias matching with priority fallback

CREATE OR REPLACE FUNCTION resolve_plan_to_network(
    p_payer_id UUID,
    p_plan_string TEXT
)
RETURNS TABLE (
    plan_id UUID,
    network_id UUID,
    plan_name TEXT,
    confidence TEXT  -- 'high' (exact alias match), 'medium' (default plan), 'low' (no match)
) AS $$
BEGIN
    -- STEP 1: Try exact alias match (highest confidence)
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.network_id,
        pp.plan_name,
        'high'::TEXT AS confidence
    FROM payer_plan_aliases ppa
    JOIN payer_plans pp ON ppa.plan_id = pp.id
    WHERE pp.payer_id = p_payer_id
      AND ppa.alias_string ILIKE p_plan_string
      AND ppa.is_active = TRUE
      AND pp.is_active = TRUE
    ORDER BY ppa.priority DESC
    LIMIT 1;

    -- If exact match found, return
    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 2: Try fuzzy match (case-insensitive, contains)
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.network_id,
        pp.plan_name,
        'high'::TEXT AS confidence
    FROM payer_plan_aliases ppa
    JOIN payer_plans pp ON ppa.plan_id = pp.id
    WHERE pp.payer_id = p_payer_id
      AND (
          ppa.alias_string ILIKE '%' || p_plan_string || '%'
          OR p_plan_string ILIKE '%' || ppa.alias_string || '%'
      )
      AND ppa.is_active = TRUE
      AND pp.is_active = TRUE
    ORDER BY ppa.priority DESC, LENGTH(ppa.alias_string) ASC  -- Prefer shorter (more specific) matches
    LIMIT 1;

    -- If fuzzy match found, return
    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 3: Fall back to default plan (medium confidence)
    RETURN QUERY
    SELECT
        pp.id AS plan_id,
        pp.network_id,
        pp.plan_name,
        'medium'::TEXT AS confidence
    FROM payer_plans pp
    WHERE pp.payer_id = p_payer_id
      AND pp.is_default = TRUE
      AND pp.is_active = TRUE
    ORDER BY pp.effective_date DESC  -- Most recent default
    LIMIT 1;

    -- If default found, return
    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 4: No match - return NULL values with low confidence
    RETURN QUERY
    SELECT
        NULL::UUID AS plan_id,
        NULL::UUID AS network_id,
        NULL::TEXT AS plan_name,
        'low'::TEXT AS confidence;

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION resolve_plan_to_network(UUID, TEXT) IS
'Resolves plan string (from 271/card) to canonical plan and network. Returns confidence level for debugging.';

-- ============================================================================
-- FUNCTION 2: CHECK IF PROVIDER IS IN NETWORK FOR PLAN
-- ============================================================================
-- Takes provider_id, payer_id, plan_string, and date
-- Returns TRUE if provider can see patients with this plan

CREATE OR REPLACE FUNCTION is_provider_in_network_for_plan(
    p_provider_id UUID,
    p_payer_id UUID,
    p_plan_string TEXT,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    in_network BOOLEAN,
    network_status TEXT,  -- 'in_network', 'supervised', 'out_of_network'
    billing_provider_id UUID,
    rendering_provider_id UUID,
    network_name TEXT,
    plan_name TEXT,
    confidence TEXT,
    reason TEXT  -- Human-readable explanation
) AS $$
DECLARE
    v_resolved_network_id UUID;
    v_resolved_plan_id UUID;
    v_resolved_plan_name TEXT;
    v_confidence TEXT;
BEGIN
    -- STEP 1: Resolve plan string to network
    SELECT
        rpn.plan_id,
        rpn.network_id,
        rpn.plan_name,
        rpn.confidence
    INTO
        v_resolved_plan_id,
        v_resolved_network_id,
        v_resolved_plan_name,
        v_confidence
    FROM resolve_plan_to_network(p_payer_id, p_plan_string) rpn;

    -- STEP 2: Check direct provider contract (in_network)
    RETURN QUERY
    SELECT
        TRUE AS in_network,
        'in_network'::TEXT AS network_status,
        NULL::UUID AS billing_provider_id,
        NULL::UUID AS rendering_provider_id,
        pn.network_name,
        v_resolved_plan_name AS plan_name,
        v_confidence,
        'Provider has direct contract with payer' ||
        CASE
            WHEN ppn.network_id IS NOT NULL THEN ' for ' || pn.network_name || ' network'
            ELSE ' (all networks)'
        END AS reason
    FROM provider_payer_networks ppn
    LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
    WHERE ppn.provider_id = p_provider_id
      AND ppn.payer_id = p_payer_id
      AND ppn.status = 'active'
      AND ppn.effective_date <= p_date
      AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
      AND (
          ppn.network_id IS NULL  -- Provider in all networks
          OR ppn.network_id = v_resolved_network_id  -- Provider in specific network
          OR v_resolved_network_id IS NULL  -- Couldn't resolve network (allow by default)
      )
    LIMIT 1;

    -- If found direct contract, return
    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 3: Check supervised relationship
    RETURN QUERY
    SELECT
        TRUE AS in_network,
        'supervised'::TEXT AS network_status,
        sr.supervisor_provider_id AS billing_provider_id,
        sr.supervisee_provider_id AS rendering_provider_id,
        pn.network_name,
        v_resolved_plan_name AS plan_name,
        v_confidence,
        'Provider supervised by attending physician for this payer' ||
        CASE
            WHEN pn.network_name IS NOT NULL THEN ' (' || pn.network_name || ' network)'
            ELSE ''
        END AS reason
    FROM supervision_relationships sr
    JOIN provider_payer_networks ppn ON sr.supervisor_provider_id = ppn.provider_id AND sr.payer_id = ppn.payer_id
    LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
    WHERE sr.supervisee_provider_id = p_provider_id
      AND sr.payer_id = p_payer_id
      AND sr.is_active = TRUE
      AND sr.start_date <= p_date
      AND (sr.end_date IS NULL OR sr.end_date >= p_date)
      AND ppn.status = 'active'
      AND ppn.effective_date <= p_date
      AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
      AND (
          ppn.network_id IS NULL
          OR ppn.network_id = v_resolved_network_id
          OR v_resolved_network_id IS NULL
      )
    LIMIT 1;

    -- If found supervised relationship, return
    IF FOUND THEN
        RETURN;
    END IF;

    -- STEP 4: Not in network
    RETURN QUERY
    SELECT
        FALSE AS in_network,
        'out_of_network'::TEXT AS network_status,
        NULL::UUID AS billing_provider_id,
        NULL::UUID AS rendering_provider_id,
        NULL::TEXT AS network_name,
        v_resolved_plan_name AS plan_name,
        v_confidence,
        CASE
            WHEN v_resolved_network_id IS NOT NULL THEN
                'Provider not in ' || (SELECT network_name FROM payer_networks WHERE id = v_resolved_network_id) || ' network'
            ELSE
                'Provider has no contract with this payer'
        END AS reason;

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_provider_in_network_for_plan(UUID, UUID, TEXT, DATE) IS
'Checks if provider can see patients with specific plan. Returns in_network status, network info, and confidence level.';

-- ============================================================================
-- FUNCTION 3: GET BOOKABLE PROVIDERS FOR PAYER AND PLAN
-- ============================================================================
-- Returns all providers available for a specific payer/plan combo
-- Used by booking API to filter availability

CREATE OR REPLACE FUNCTION get_bookable_providers_for_plan(
    p_payer_id UUID,
    p_plan_string TEXT DEFAULT NULL,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    provider_id UUID,
    network_status TEXT,
    billing_provider_id UUID,
    rendering_provider_id UUID,
    network_name TEXT,
    plan_name TEXT,
    effective_date DATE
) AS $$
DECLARE
    v_resolved_network_id UUID;
    v_resolved_plan_name TEXT;
BEGIN
    -- If plan_string provided, resolve it
    IF p_plan_string IS NOT NULL THEN
        SELECT rpn.network_id, rpn.plan_name
        INTO v_resolved_network_id, v_resolved_plan_name
        FROM resolve_plan_to_network(p_payer_id, p_plan_string) rpn;
    END IF;

    -- Return direct contracts
    RETURN QUERY
    SELECT
        ppn.provider_id,
        'in_network'::TEXT AS network_status,
        NULL::UUID AS billing_provider_id,
        NULL::UUID AS rendering_provider_id,
        pn.network_name,
        COALESCE(v_resolved_plan_name, 'Any plan in network') AS plan_name,
        ppn.effective_date
    FROM provider_payer_networks ppn
    LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
    WHERE ppn.payer_id = p_payer_id
      AND ppn.status = 'active'
      AND ppn.effective_date <= p_date
      AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
      AND (
          ppn.network_id IS NULL
          OR ppn.network_id = v_resolved_network_id
          OR v_resolved_network_id IS NULL
      )

    UNION

    -- Return supervised relationships
    SELECT
        sr.supervisee_provider_id AS provider_id,
        'supervised'::TEXT AS network_status,
        sr.supervisor_provider_id AS billing_provider_id,
        sr.supervisee_provider_id AS rendering_provider_id,
        pn.network_name,
        COALESCE(v_resolved_plan_name, 'Any plan in network') AS plan_name,
        sr.start_date AS effective_date
    FROM supervision_relationships sr
    JOIN provider_payer_networks ppn ON sr.supervisor_provider_id = ppn.provider_id AND sr.payer_id = ppn.payer_id
    LEFT JOIN payer_networks pn ON ppn.network_id = pn.id
    WHERE sr.payer_id = p_payer_id
      AND sr.is_active = TRUE
      AND sr.start_date <= p_date
      AND (sr.end_date IS NULL OR sr.end_date >= p_date)
      AND ppn.status = 'active'
      AND ppn.effective_date <= p_date
      AND (ppn.expiration_date IS NULL OR ppn.expiration_date >= p_date)
      AND (
          ppn.network_id IS NULL
          OR ppn.network_id = v_resolved_network_id
          OR v_resolved_network_id IS NULL
      );

    RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_bookable_providers_for_plan(UUID, TEXT, DATE) IS
'Returns all providers who can see patients with this payer/plan combination';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

DO $$
BEGIN
    -- Test that functions were created
    ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname IN (
        'resolve_plan_to_network',
        'is_provider_in_network_for_plan',
        'get_bookable_providers_for_plan'
    )) = 3, 'Expected 3 helper functions to be created';

    RAISE NOTICE '✅ Migration 024 complete: Plan resolution helper functions created';
    RAISE NOTICE '   - resolve_plan_to_network(): Maps plan strings to networks';
    RAISE NOTICE '   - is_provider_in_network_for_plan(): Checks provider eligibility';
    RAISE NOTICE '   - get_bookable_providers_for_plan(): Returns available providers';
END $$;

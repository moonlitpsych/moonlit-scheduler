-- Migration 027: Update Booking Trigger for Plan-Aware Validation
-- Purpose: Validate provider-payer relationships using plan resolution
-- Context: Prevent booking errors when patient's plan doesn't match provider's network
-- Date: 2025-10-31

-- ============================================================================
-- UPDATE TRIGGER FUNCTION FOR PLAN-AWARE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
DECLARE
    v_row record;
    v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
    v_plan_name TEXT := NULL;
    v_network_check record;
    v_error_message TEXT;
BEGIN
    -- Skip validation if no payer specified
    IF NEW.payer_id IS NULL THEN
        RAISE NOTICE '[TRIGGER] No payer_id specified, skipping validation';
        RETURN NEW;
    END IF;

    -- Extract plan_name from insurance_info JSONB (if provided)
    IF NEW.insurance_info IS NOT NULL AND NEW.insurance_info ? 'plan_name' THEN
        v_plan_name := NEW.insurance_info->>'plan_name';
        RAISE NOTICE '[TRIGGER] Plan name provided: %', v_plan_name;
    ELSE
        RAISE NOTICE '[TRIGGER] No plan name provided, will check payer-level access';
    END IF;

    -- OPTION 1: If plan_name provided, use plan-aware validation
    IF v_plan_name IS NOT NULL AND v_plan_name <> '' THEN
        RAISE NOTICE '[TRIGGER] Using plan-aware validation for: %', v_plan_name;

        -- Call is_provider_in_network_for_plan function
        SELECT *
        INTO v_network_check
        FROM is_provider_in_network_for_plan(
            NEW.provider_id,
            NEW.payer_id,
            v_plan_name,
            v_dos
        )
        LIMIT 1;

        IF v_network_check.in_network = FALSE OR v_network_check.in_network IS NULL THEN
            -- Provider not in network for this specific plan
            v_error_message := format(
                'Provider not in network for plan "%s" on this date. %s',
                v_plan_name,
                COALESCE(v_network_check.reason, 'Provider has no contract with this payer or network.')
            );

            RAISE EXCEPTION '%', v_error_message
            USING HINT = 'The patient may have a different plan/network than expected. Verify insurance card or run 271 eligibility check.';
        END IF;

        -- Provider is in network for this plan
        RAISE NOTICE '[TRIGGER] ✅ Provider in network for plan "%" via %', v_plan_name, v_network_check.network_status;
        RETURN NEW;
    END IF;

    -- OPTION 2: No plan_name provided, fall back to payer-level validation (backward compatible)
    RAISE NOTICE '[TRIGGER] Using payer-level validation (no plan specified)';

    SELECT
        b.*,
        CASE
            WHEN b.network_status = 'in_network' THEN 'direct'
            WHEN b.network_status = 'supervised' THEN 'supervised'
            ELSE 'direct'
        END as via
    INTO v_row
    FROM public.v_bookable_provider_payer b
    WHERE b.payer_id = NEW.payer_id
        AND b.provider_id = NEW.provider_id
        -- Check date is within effective range
        AND v_dos >= COALESCE(b.bookable_from_date, b.effective_date)
        AND (b.expiration_date IS NULL OR v_dos <= b.expiration_date)
    LIMIT 1;

    IF NOT FOUND THEN
        -- Build helpful error message
        v_error_message := 'Provider not in network with this payer on the selected date.';

        -- Check if provider has ANY contract with this payer (but not effective on this date)
        IF EXISTS (
            SELECT 1 FROM public.v_bookable_provider_payer
            WHERE payer_id = NEW.payer_id AND provider_id = NEW.provider_id
        ) THEN
            v_error_message := v_error_message || ' Contract may not be effective yet or has expired.';
        ELSE
            v_error_message := v_error_message || ' Provider has no contract with this payer.';
        END IF;

        RAISE EXCEPTION '%', v_error_message
        USING HINT = 'Verify provider-payer relationship in admin dashboard or run eligibility check.';
    END IF;

    -- Success: Provider-payer relationship exists and is valid for this date
    RAISE NOTICE '[TRIGGER] ✅ Provider in network with payer via %', v_row.via;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFY TRIGGER IS ATTACHED TO APPOINTMENTS TABLE
-- ============================================================================

DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    -- Check if trigger exists
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'check_bookable_provider_payer'
          AND tgrelid = 'appointments'::regclass
    ) INTO v_trigger_exists;

    IF NOT v_trigger_exists THEN
        RAISE NOTICE 'Creating trigger on appointments table...';

        CREATE TRIGGER check_bookable_provider_payer
            BEFORE INSERT OR UPDATE ON appointments
            FOR EACH ROW
            EXECUTE FUNCTION enforce_bookable_provider_payer();

        RAISE NOTICE '✅ Trigger created';
    ELSE
        RAISE NOTICE '✅ Trigger already exists (function updated)';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 027 complete: Booking trigger now validates plan-specific network access';
    RAISE NOTICE '   - Accepts optional plan_name from insurance_info JSONB';
    RAISE NOTICE '   - Falls back to payer-level validation if no plan specified';
    RAISE NOTICE '   - Provides detailed error messages with hints';
END $$;

-- ============================================================================
-- TESTING QUERIES
-- ============================================================================

-- Test 1: Simulate booking with plan name (won't actually insert, just test validation logic)
-- SELECT is_provider_in_network_for_plan(
--     '[provider-id]'::UUID,
--     '[payer-id]'::UUID,
--     'REGENCE BCBS',
--     CURRENT_DATE
-- );

-- Test 2: Check which providers can see patients with specific plan
-- SELECT * FROM get_bookable_providers_for_plan(
--     '[payer-id]'::UUID,
--     'SelectHealth Advantage',
--     CURRENT_DATE
-- );

-- Test 3: Verify trigger function was updated
-- SELECT
--   proname AS function_name,
--   prosrc LIKE '%is_provider_in_network_for_plan%' AS uses_plan_validation,
--   pg_get_functiondef(oid) AS full_definition
-- FROM pg_proc
-- WHERE proname = 'enforce_bookable_provider_payer';

-- Migration 030: Update Booking Trigger for Plan Validation (Junction Table Version)
-- Purpose: Validate bookings using provider_payer_accepted_plans junction table
-- Context: Checks if provider's contract accepts patient's specific plan
-- Date: 2025-10-31

-- ============================================================================
-- UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
DECLARE
    v_row record;
    v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
    v_plan_name TEXT := NULL;
    v_plan_check record;
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
        RAISE NOTICE '[TRIGGER] No plan name provided, will check payer-level only';
    END IF;

    -- Use does_provider_accept_plan function to validate
    SELECT *
    INTO v_plan_check
    FROM does_provider_accept_plan(
        NEW.provider_id,
        NEW.payer_id,
        v_plan_name,
        v_dos
    )
    LIMIT 1;

    -- Check result
    IF v_plan_check.accepts_plan = FALSE THEN
        -- Provider cannot accept this plan
        v_error_message := format(
            'Provider cannot accept this plan. %s',
            v_plan_check.reason
        );

        RAISE EXCEPTION '%', v_error_message
        USING HINT = CASE v_plan_check.contract_status
            WHEN 'no_contract' THEN 'Provider has no contract with this payer. Check /admin/bookability.'
            WHEN 'plan_not_accepted' THEN 'Provider''s contract does not include this specific plan. Verify insurance card or contract documentation.'
            ELSE 'Contact admin to verify contract and accepted plans.'
        END;
    END IF;

    -- Success
    RAISE NOTICE '[TRIGGER] ✅ Provider can accept plan via %', v_plan_check.contract_status;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFY TRIGGER IS ATTACHED
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
    RAISE NOTICE '✅ Migration 030 complete: Booking trigger updated';
    RAISE NOTICE '   - Trigger now uses does_provider_accept_plan() function';
    RAISE NOTICE '   - Validates against provider_payer_accepted_plans junction table';
    RAISE NOTICE '   - Falls back to payer-level validation if no plan_name provided';
    RAISE NOTICE '';
    RAISE NOTICE 'How it works:';
    RAISE NOTICE '   1. Patient books with plan_name in insurance_info';
    RAISE NOTICE '   2. Trigger resolves plan_name to plan_id';
    RAISE NOTICE '   3. Checks if provider''s contract accepts that plan_id';
    RAISE NOTICE '   4. Allows booking if accepted, rejects if not';
END $$;

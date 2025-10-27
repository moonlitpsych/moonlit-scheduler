-- Migration 022: Fix booking trigger to use RPC function instead of view
-- Problem: Trigger uses v_bookable_provider_payer view which has CURRENT_DATE filter
-- Solution: Update trigger to use fn_bookable_provider_payer_asof with appointment date

-- Drop existing trigger (actual name is trg_enforce_bookable_on_appointments)
DROP TRIGGER IF EXISTS trg_enforce_bookable_on_appointments ON appointments;
DROP TRIGGER IF EXISTS enforce_bookable_provider_payer ON appointments;

-- Drop existing function
DROP FUNCTION IF EXISTS enforce_bookable_provider_payer() CASCADE;

-- Create updated trigger function that uses RPC with appointment date
CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
DECLARE
    v_is_bookable BOOLEAN;
    v_appointment_date DATE;
BEGIN
    -- Skip validation for cash/self-pay (no payer)
    IF NEW.payer_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Extract date from start_time (with timezone conversion like original trigger)
    v_appointment_date := (NEW.start_time AT TIME ZONE 'America/Denver')::DATE;

    -- Check if provider-payer relationship is bookable on the appointment date
    -- Use RPC function with appointment date instead of view
    SELECT EXISTS (
        SELECT 1
        FROM fn_bookable_provider_payer_asof(v_appointment_date)
        WHERE provider_id = NEW.provider_id
          AND payer_id = NEW.payer_id
    ) INTO v_is_bookable;

    IF NOT v_is_bookable THEN
        RAISE EXCEPTION 'Not bookable for this payer on the selected date'
            USING HINT = 'Provider ' || NEW.provider_id || ' is not bookable for payer ' || NEW.payer_id || ' on ' || v_appointment_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER enforce_bookable_provider_payer
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_bookable_provider_payer();

-- Test the trigger with the problematic booking
-- This should NOT raise an exception now
DO $$
BEGIN
    -- Test: Dr. Reynolds (bc0fc904) with Regence BCBS (b9e556b7) on Nov 3, 2025
    -- This should work because RPC returns the relationship for Nov 3
    PERFORM 1 FROM fn_bookable_provider_payer_asof('2025-11-03')
    WHERE provider_id = 'bc0fc904-7cc9-4d22-a094-6a0eb482128d'
      AND payer_id = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test failed: Dr. Reynolds should be bookable for Regence BCBS on Nov 3';
    END IF;

    RAISE NOTICE 'Trigger test passed: Dr. Reynolds is bookable for Regence BCBS on Nov 3';
END $$;

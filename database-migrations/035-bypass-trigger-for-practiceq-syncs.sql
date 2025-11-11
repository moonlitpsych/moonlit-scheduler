-- Migration: Bypass bookability trigger for PracticeQ synced appointments
-- Date: November 11, 2025
-- Purpose: Allow historical appointments from PracticeQ to sync without validation
--
-- PROBLEM:
-- PracticeQ sync service pulls existing appointments from production EHR
-- These appointments were already approved by intake/scheduling team
-- But enforce_bookable_provider_payer() trigger blocks them if:
--   - Provider-payer contract is missing in database
--   - Provider-payer contract has expired
--   - Appointment predates our strict credentialing rules
--
-- EXAMPLE:
-- Michael Sweitzer's upcoming appointment (PQ ID: 68ee4695834e17b38b067b4b)
-- Failed with: "Provider not bookable with this payer on the selected date"
-- This is a real appointment scheduled by staff in PracticeQ
--
-- SOLUTION:
-- Skip validation for any appointment with pq_appointment_id (came from PracticeQ)
-- Only validate NEW bookings created through patient booking flow (no pq_appointment_id)
--
-- REASONING:
-- - Historical syncs: Appointments already exist in EHR, already approved
-- - New bookings: Fresh appointments need validation against current contracts
--
-- ============================================================================
-- Update trigger to bypass validation for PracticeQ synced appointments
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_bookable_provider_payer()
RETURNS TRIGGER AS $$
  DECLARE
    v_row record;
    v_dos date := (NEW.start_time AT TIME ZONE 'America/Denver')::date;
    v_appt tstzrange := tstzrange(NEW.start_time, NEW.end_time, '[]');
    v_tz text := 'America/Denver';
  BEGIN
    -- NEW: Skip validation for PracticeQ synced appointments
    -- These appointments already exist in production EHR and were already approved
    IF NEW.pq_appointment_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Skip validation if no payer specified
    IF NEW.payer_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Validate NEW bookings only (no pq_appointment_id)
    -- Use canonical view v_bookable_provider_payer
    SELECT
      b.*,
      CASE
        WHEN b.network_status = 'in_network' THEN 'direct'
        WHEN b.network_status = 'supervised' THEN 'supervised'
        ELSE 'direct'
      END as via,
      false as requires_co_visit
    INTO v_row
    FROM public.v_bookable_provider_payer b
    WHERE b.payer_id = NEW.payer_id
      AND b.provider_id = NEW.provider_id
      -- Check date is within effective range
      AND v_dos >= COALESCE(b.bookable_from_date, b.effective_date)
      AND (b.expiration_date IS NULL OR v_dos <= b.expiration_date)
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not bookable for this payer on the selected date';
    END IF;

    -- For supervised relationships, verify attending provider if needed
    IF v_row.network_status = 'supervised' AND v_row.billing_provider_id IS NOT NULL THEN
      -- The provider is supervised, ensure we have proper attending info
      -- For now, we'll allow it and let the business logic handle supervision requirements
      NULL;  -- Placeholder for future supervision validation
    END IF;

    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification
-- ============================================================================

-- After running this migration, PracticeQ syncs should work for all appointments
-- regardless of provider-payer bookability status.

-- Test by re-syncing Michael Sweitzer's appointments - should see appointment
-- with PQ ID 68ee4695834e17b38b067b4b sync successfully.

-- ============================================================================
-- Notes
-- ============================================================================

-- The trigger now has two modes:
-- 1. PracticeQ sync (pq_appointment_id present): SKIP validation ✅
-- 2. New patient booking (no pq_appointment_id): VALIDATE against contracts ✅

-- This ensures:
-- - Historical data syncs without blocks
-- - New bookings still respect credentialing rules

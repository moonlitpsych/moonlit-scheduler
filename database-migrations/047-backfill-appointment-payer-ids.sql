-- =====================================================================
-- Migration 047: Backfill Appointment Payer IDs from Patient Records
-- =====================================================================
-- Purpose: Copy payer_id from patients.primary_payer_id to appointments.payer_id
-- This fixes the 96% of appointments showing "Cash" when they should have insurance
-- =====================================================================

begin;

-- Update appointments with missing payer_id from their patient's primary payer
UPDATE appointments
SET payer_id = patients.primary_payer_id
FROM patients
WHERE appointments.patient_id = patients.id
  AND appointments.payer_id IS NULL
  AND patients.primary_payer_id IS NOT NULL;

-- Verification: Show before/after counts
DO $$
DECLARE
  v_total_appointments int;
  v_with_payer int;
  v_without_payer int;
  v_updated int;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total_appointments FROM appointments;

  -- Get count with payer
  SELECT COUNT(*) INTO v_with_payer FROM appointments WHERE payer_id IS NOT NULL;

  -- Get count without payer
  SELECT COUNT(*) INTO v_without_payer FROM appointments WHERE payer_id IS NULL;

  -- Get updated count (estimate)
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Appointment Payer Backfill Results:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total appointments: %', v_total_appointments;
  RAISE NOTICE 'Appointments with payer: % (% %%)', v_with_payer, ROUND(100.0 * v_with_payer / NULLIF(v_total_appointments, 0), 2);
  RAISE NOTICE 'Appointments without payer: % (% %%)', v_without_payer, ROUND(100.0 * v_without_payer / NULLIF(v_total_appointments, 0), 2);
  RAISE NOTICE '=================================================================';
END $$;

-- Show payer distribution
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Payer Distribution:';
  RAISE NOTICE '=================================================================';

  FOR r IN (
    SELECT
      COALESCE(p.name, 'No Payer (Cash)') as payer_name,
      COUNT(a.id) as appointment_count,
      ROUND(100.0 * COUNT(a.id) / NULLIF((SELECT COUNT(*) FROM appointments), 0), 2) as percentage
    FROM appointments a
    LEFT JOIN payers p ON p.id = a.payer_id
    GROUP BY p.name
    ORDER BY COUNT(a.id) DESC
    LIMIT 10
  ) LOOP
    RAISE NOTICE '% | % appointments (% %%)',
      RPAD(r.payer_name, 40),
      LPAD(r.appointment_count::text, 5),
      LPAD(r.percentage::text, 6);
  END LOOP;

  RAISE NOTICE '=================================================================';
END $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Next steps:
-- 1. Re-sync appointments from PracticeQ to populate payer_id directly from IntakeQ
-- 2. This will override backfilled data with actual insurance info from custom fields
-- =====================================================================

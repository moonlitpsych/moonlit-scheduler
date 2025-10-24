/**
 * Migration 016: Backfill primary_provider_id for Existing Patients
 *
 * Purpose:
 * - Assigns each patient to their "primary provider" based on appointment history
 * - Uses the provider they've seen most frequently
 * - In case of ties, uses the provider from the most recent appointment
 *
 * Logic:
 * 1. Count appointments per patient-provider pair
 * 2. Rank by frequency (most appointments) then recency (latest appointment)
 * 3. Set primary_provider_id to the top-ranked provider
 *
 * Safe to re-run: Only updates NULL values, won't overwrite existing assignments
 */

-- Step 1: Calculate provider frequency and recency for each patient
WITH provider_frequency AS (
  SELECT
    patient_id,
    provider_id,
    COUNT(*) as appointment_count,
    MAX(start_time) as last_appointment_date
  FROM appointments
  WHERE provider_id IS NOT NULL
    AND status IN ('completed', 'confirmed', 'scheduled')
  GROUP BY patient_id, provider_id
),

-- Step 2: Rank providers for each patient (1 = primary)
ranked_providers AS (
  SELECT DISTINCT ON (patient_id)
    patient_id,
    provider_id,
    appointment_count,
    last_appointment_date
  FROM provider_frequency
  ORDER BY
    patient_id,
    appointment_count DESC,      -- Most appointments first
    last_appointment_date DESC   -- Most recent if tied
)

-- Step 3: Update patients table with primary provider
UPDATE patients
SET
  primary_provider_id = ranked_providers.provider_id,
  updated_at = NOW()
FROM ranked_providers
WHERE patients.id = ranked_providers.patient_id
  AND patients.primary_provider_id IS NULL;  -- Only update if not already set

-- Show results
SELECT
  COUNT(*) as patients_updated
FROM patients
WHERE primary_provider_id IS NOT NULL;

-- Optional: Show patient-provider assignments for verification
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  pr.first_name as provider_first_name,
  pr.last_name as provider_last_name,
  (
    SELECT COUNT(*)
    FROM appointments a
    WHERE a.patient_id = p.id
      AND a.provider_id = p.primary_provider_id
  ) as appointment_count_with_provider
FROM patients p
LEFT JOIN providers pr ON p.primary_provider_id = pr.id
WHERE p.primary_provider_id IS NOT NULL
ORDER BY p.last_name, p.first_name
LIMIT 20;

COMMENT ON COLUMN patients.primary_provider_id IS 'The provider this patient primarily sees. Auto-assigned during first booking or manually set by admin.';

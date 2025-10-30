-- =====================================================================
-- Migration 046: Set Default CPT Codes for Services
-- =====================================================================
-- Purpose: Populate services.default_cpt for fee schedule lookups
-- Uses conservative E&M codes for financial planning
-- =====================================================================

begin;

-- Update Intake service to use 99204 (moderate complexity, 45-59 min)
UPDATE services
SET default_cpt = '99204'
WHERE name = ' Intake'
  AND default_cpt IS NULL;

-- Update Follow-up (Short) to use 99214 (established patient, 30 min)
UPDATE services
SET default_cpt = '99214'
WHERE name = 'Follow-up (Short)'
  AND default_cpt IS NULL;

-- Update Follow-up (Extended) to use 99215 (established patient, 45-59 min)
-- Only update where default_cpt is null (preserve existing 90836 mapping)
UPDATE services
SET default_cpt = '99215'
WHERE name = 'Follow-up (Extended)'
  AND default_cpt IS NULL;

-- Verification: Show all services with their default CPT codes
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Services with Default CPT Codes (after update):';
  RAISE NOTICE '=================================================================';

  FOR r IN (
    SELECT
      name,
      default_cpt,
      price as price_cents,
      (SELECT COUNT(*) FROM service_instances WHERE service_id = services.id) as instance_count
    FROM services
    ORDER BY name
  ) LOOP
    RAISE NOTICE '% | CPT: % | Price: $% | Instances: %',
      RPAD(r.name, 25),
      COALESCE(r.default_cpt, 'NULL'),
      COALESCE((r.price_cents::numeric / 100)::numeric(10,2)::text, 'NULL'),
      r.instance_count;
  END LOOP;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Services with default_cpt: %', (SELECT COUNT(*) FROM services WHERE default_cpt IS NOT NULL);
  RAISE NOTICE 'Services without default_cpt: %', (SELECT COUNT(*) FROM services WHERE default_cpt IS NULL);
END $$;

commit;

-- =====================================================================
-- Migration Complete
-- =====================================================================
-- Updated default CPT codes:
--   Intake → 99204 (conservative estimate for new patient visits)
--   Follow-up (Short) → 99214 (established patient, 30 min)
--   Follow-up (Extended) → 99215 (established patient, 45-59 min)
--
-- These are E&M codes for fee schedule lookups.
-- Therapy add-on codes (90833, 90836, 90838) are billed alongside E&M.
-- =====================================================================

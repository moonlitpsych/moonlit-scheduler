-- Migration: Service Instances Management
-- Date: October 7, 2025
-- Purpose: Add UNIQUE constraint, create readable view, backfill service instances

-- ============================================================================
-- PART 1: Create readable view for service instances
-- ============================================================================

CREATE OR REPLACE VIEW v_service_instances_readable AS
SELECT 
    si.id as service_instance_id,
    s.name as service_name,
    s.duration_minutes,
    p.name as payer_name,
    p.payer_type,
    si.location,
    si.pos_code,
    sii.system as integration_system,
    sii.external_id as integration_external_id,
    si.service_id,
    si.payer_id
FROM service_instances si
LEFT JOIN services s ON si.service_id = s.id
LEFT JOIN payers p ON si.payer_id = p.id
LEFT JOIN service_instance_integrations sii ON si.id = sii.service_instance_id
ORDER BY p.name, s.name;

COMMENT ON VIEW v_service_instances_readable IS 'Human-readable view of service instances with service and payer names';

-- ============================================================================
-- PART 2: Add UNIQUE constraint to prevent duplicates
-- ============================================================================

-- First, check if there are any duplicates that would violate the constraint
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT service_id, payer_id, location, pos_code, COUNT(*) as cnt
        FROM service_instances
        WHERE payer_id IS NOT NULL
        GROUP BY service_id, payer_id, location, pos_code
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'Found % duplicate service instance combinations. Please resolve before adding constraint.', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicates found. Safe to add constraint.';
    END IF;
END $$;

-- Add UNIQUE constraint (will fail if duplicates exist)
ALTER TABLE service_instances
ADD CONSTRAINT service_instances_unique_payer_service_location 
UNIQUE (service_id, payer_id, location, pos_code);

COMMENT ON CONSTRAINT service_instances_unique_payer_service_location ON service_instances 
IS 'Prevents duplicate service instances for the same payer, service, location, and POS code combination';

-- ============================================================================
-- PART 3: Delete orphaned service instances (payer_id = null)
-- ============================================================================

-- First, verify no appointments reference these orphaned instances
DO $$
DECLARE
    orphaned_with_appointments INTEGER;
BEGIN
    SELECT COUNT(DISTINCT a.id) INTO orphaned_with_appointments
    FROM appointments a
    JOIN service_instances si ON a.service_instance_id = si.id
    WHERE si.payer_id IS NULL;
    
    IF orphaned_with_appointments > 0 THEN
        RAISE EXCEPTION 'Cannot delete orphaned service instances: % appointments reference them', orphaned_with_appointments;
    ELSE
        RAISE NOTICE 'Safe to delete orphaned service instances (no appointments reference them)';
    END IF;
END $$;

-- Delete service_instance_integrations for orphaned instances first (FK constraint)
DELETE FROM service_instance_integrations
WHERE service_instance_id IN (
    SELECT id FROM service_instances WHERE payer_id IS NULL
);

-- Delete orphaned service instances
DELETE FROM service_instances
WHERE payer_id IS NULL;

-- ============================================================================
-- PART 4: Backfill service instances for approved payers with contracts
-- ============================================================================

-- Service IDs (from services table verification)
-- " Intake" (telehealth): f0a05d4c-188a-4f1b-9600-54d6c27a3f62
-- "Follow-up (Short)" (home): 4b6e81ed-e30e-4127-ba71-21aa9fac8cd1
-- "Follow-up (Extended)" (home): a6cdf789-41f7-484d-a948-272547eb566e

-- IntakeQ external IDs (from CLAUDE.md)
-- Intake: 137bcec9-6d59-4cd8-910f-a1d9c0616319
-- Follow-up Short: 436ebccd-7e5b-402d-9f13-4c5733e3af8c
-- Follow-up Extended: f0490d0a-992f-4f14-836f-0e41e11be14d

DO $$
DECLARE
    payer_record RECORD;
    new_instance_id UUID;
    instances_created INTEGER := 0;
    integrations_created INTEGER := 0;
BEGIN
    -- Loop through approved payers with contracts and effective dates
    FOR payer_record IN
        SELECT DISTINCT p.id, p.name
        FROM payers p
        INNER JOIN provider_payer_networks ppn ON p.id = ppn.payer_id
        WHERE p.effective_date IS NOT NULL
          AND (p.status_code = 'approved' OR p.status_code IS NULL)
        ORDER BY p.name
    LOOP
        RAISE NOTICE 'Processing payer: % (%)', payer_record.name, payer_record.id;
        
        -- Create Intake service instance
        IF NOT EXISTS (
            SELECT 1 FROM service_instances 
            WHERE payer_id = payer_record.id 
              AND service_id = 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62'
              AND location = 'Telehealth'
              AND pos_code = '10'
        ) THEN
            INSERT INTO service_instances (service_id, payer_id, location, pos_code)
            VALUES ('f0a05d4c-188a-4f1b-9600-54d6c27a3f62', payer_record.id, 'Telehealth', '10')
            RETURNING id INTO new_instance_id;
            
            INSERT INTO service_instance_integrations (service_instance_id, system, external_id)
            VALUES (new_instance_id, 'intakeq', '137bcec9-6d59-4cd8-910f-a1d9c0616319');
            
            instances_created := instances_created + 1;
            integrations_created := integrations_created + 1;
            RAISE NOTICE '  ✓ Created Intake service instance';
        END IF;
        
        -- Create Follow-up (Short) service instance
        IF NOT EXISTS (
            SELECT 1 FROM service_instances 
            WHERE payer_id = payer_record.id 
              AND service_id = '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1'
              AND location = 'Telehealth'
              AND pos_code = '10'
        ) THEN
            INSERT INTO service_instances (service_id, payer_id, location, pos_code)
            VALUES ('4b6e81ed-e30e-4127-ba71-21aa9fac8cd1', payer_record.id, 'Telehealth', '10')
            RETURNING id INTO new_instance_id;
            
            INSERT INTO service_instance_integrations (service_instance_id, system, external_id)
            VALUES (new_instance_id, 'intakeq', '436ebccd-7e5b-402d-9f13-4c5733e3af8c');
            
            instances_created := instances_created + 1;
            integrations_created := integrations_created + 1;
            RAISE NOTICE '  ✓ Created Follow-up (Short) service instance';
        END IF;
        
        -- Create Follow-up (Extended) service instance
        IF NOT EXISTS (
            SELECT 1 FROM service_instances 
            WHERE payer_id = payer_record.id 
              AND service_id = 'a6cdf789-41f7-484d-a948-272547eb566e'
              AND location = 'Telehealth'
              AND pos_code = '10'
        ) THEN
            INSERT INTO service_instances (service_id, payer_id, location, pos_code)
            VALUES ('a6cdf789-41f7-484d-a948-272547eb566e', payer_record.id, 'Telehealth', '10')
            RETURNING id INTO new_instance_id;
            
            INSERT INTO service_instance_integrations (service_instance_id, system, external_id)
            VALUES (new_instance_id, 'intakeq', 'f0490d0a-992f-4f14-836f-0e41e11be14d');
            
            instances_created := instances_created + 1;
            integrations_created := integrations_created + 1;
            RAISE NOTICE '  ✓ Created Follow-up (Extended) service instance';
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Backfill complete:';
    RAISE NOTICE '  Service instances created: %', instances_created;
    RAISE NOTICE '  IntakeQ integrations created: %', integrations_created;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View the human-readable service instances
-- SELECT * FROM v_service_instances_readable WHERE payer_name IS NOT NULL ORDER BY payer_name, service_name;

-- Count service instances per payer
-- SELECT payer_name, COUNT(*) as instance_count
-- FROM v_service_instances_readable
-- WHERE payer_name IS NOT NULL
-- GROUP BY payer_name
-- ORDER BY payer_name;

-- Find payers without service instances (should be empty after backfill)
-- SELECT p.name as payer_name
-- FROM payers p
-- LEFT JOIN service_instances si ON p.id = si.payer_id
-- WHERE si.id IS NULL
--   AND p.effective_date IS NOT NULL
-- ORDER BY p.name;

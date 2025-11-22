-- 007-backfill-intake-service-instances-all-payers.sql
-- Purpose: Ensure every payer has an Intake Telehealth service_instance
--          mapped to the IntakeQ Intake service.
-- Safety:  Only INSERTs when a matching instance does NOT already exist.

DO $$
DECLARE
  payer_record RECORD;
  new_instance_id UUID;
  instances_created INTEGER := 0;
  integrations_created INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting global Intake Telehealth service instance backfill...';

  FOR payer_record IN
    SELECT id, name
    FROM payers
    ORDER BY name
  LOOP
    RAISE NOTICE 'Processing payer: % (%)', payer_record.name, payer_record.id;

    -- If this payer already has an Intake Telehealth instance mapped to IntakeQ, skip it
    IF EXISTS (
      SELECT 1
      FROM service_instances si
      JOIN service_instance_integrations sii
        ON sii.service_instance_id = si.id
       AND sii.system = 'intakeq'
       AND sii.external_id = '137bcec9-6d59-4cd8-910f-a1d9c0616319' -- Intake service
      WHERE si.payer_id = payer_record.id
        AND si.service_id = 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62'  -- Intake (telehealth)
        AND si.location = 'Telehealth'
        AND si.pos_code = '10'
    ) THEN
      RAISE NOTICE '  ✓ Intake Telehealth instance already exists – skipping';
      CONTINUE;
    END IF;

    -- Otherwise, create it
    INSERT INTO service_instances (service_id, payer_id, location, pos_code)
    VALUES ('f0a05d4c-188a-4f1b-9600-54d6c27a3f62', payer_record.id, 'Telehealth', '10')
    RETURNING id INTO new_instance_id;

    instances_created := instances_created + 1;
    RAISE NOTICE '  ✓ Created Intake Telehealth service instance with id %', new_instance_id;

    INSERT INTO service_instance_integrations (service_instance_id, system, external_id)
    VALUES (new_instance_id, 'intakeq', '137bcec9-6d59-4cd8-910f-a1d9c0616319');

    integrations_created := integrations_created + 1;
    RAISE NOTICE '  ✓ Created IntakeQ integration row';
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Global Intake Telehealth backfill complete:';
  RAISE NOTICE '  Service instances created: %', instances_created;
  RAISE NOTICE '  IntakeQ integrations created: %', integrations_created;
  RAISE NOTICE '========================================';
END $$;
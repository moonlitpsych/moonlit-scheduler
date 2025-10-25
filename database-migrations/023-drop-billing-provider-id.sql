-- Migration 023: Drop billing_provider_id column
-- This column was creating an ambiguous foreign key relationship
-- Supervision is handled entirely in supervision_relationships table

BEGIN;

-- Drop the billing_provider_id column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'provider_payer_networks'
               AND column_name = 'billing_provider_id') THEN
        ALTER TABLE provider_payer_networks
        DROP COLUMN billing_provider_id;

        RAISE NOTICE 'Dropped billing_provider_id from provider_payer_networks';
    ELSE
        RAISE NOTICE 'billing_provider_id does not exist in provider_payer_networks';
    END IF;
END $$;

COMMIT;

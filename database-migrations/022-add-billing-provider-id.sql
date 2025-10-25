-- Migration 022: Add billing_provider_id to provider_payer_networks
-- This column stores the supervising/billing provider for supervised contracts

BEGIN;

-- Add billing_provider_id to provider_payer_networks (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'provider_payer_networks'
                   AND column_name = 'billing_provider_id') THEN
        ALTER TABLE provider_payer_networks
        ADD COLUMN billing_provider_id UUID REFERENCES providers(id);

        RAISE NOTICE 'Added billing_provider_id to provider_payer_networks';
    ELSE
        RAISE NOTICE 'billing_provider_id already exists in provider_payer_networks';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_provider_payer_networks_billing_provider
ON provider_payer_networks(billing_provider_id)
WHERE billing_provider_id IS NOT NULL;

COMMIT;

-- Verification query
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'provider_payer_networks'
AND column_name = 'billing_provider_id';
*/

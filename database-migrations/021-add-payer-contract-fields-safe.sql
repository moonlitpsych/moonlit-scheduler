-- Migration 021: SAFE additive-only migration for payer contract automation
-- This migration ONLY ADDS new fields and does NOT rename or change existing fields
-- All changes are backward-compatible

BEGIN;

-- ============================================
-- STEP 1: Add new columns to existing tables (if they don't exist)
-- ============================================

-- Add missing columns to supervision_relationships table (if it exists)
DO $$
BEGIN
    -- Only add payer_id if it doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supervision_relationships') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'payer_id') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN payer_id UUID REFERENCES payers(id);
            RAISE NOTICE 'Added payer_id to supervision_relationships';
        END IF;

        -- Add supervision_type if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'supervision_type') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN supervision_type TEXT DEFAULT 'general';
            RAISE NOTICE 'Added supervision_type to supervision_relationships';
        END IF;

        -- Add start_date if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'start_date') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
            RAISE NOTICE 'Added start_date to supervision_relationships';
        END IF;

        -- Add end_date if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'end_date') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN end_date DATE;
            RAISE NOTICE 'Added end_date to supervision_relationships';
        END IF;

        -- Add is_active if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'is_active') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
            RAISE NOTICE 'Added is_active to supervision_relationships';
        END IF;

        -- Add supervision_level if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'supervision_level') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN supervision_level TEXT DEFAULT 'sign_off_only';
            RAISE NOTICE 'Added supervision_level to supervision_relationships';
        END IF;

        -- Add notes if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'notes') THEN
            ALTER TABLE supervision_relationships
            ADD COLUMN notes TEXT;
            RAISE NOTICE 'Added notes to supervision_relationships';
        END IF;

        -- NOTE: We are NOT renaming existing columns like attending_provider_id or resident_provider_id
        -- The application will need to handle both naming conventions
    END IF;
END $$;

-- Add missing columns to payers table
DO $$
BEGIN
    -- Add allows_supervised if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'allows_supervised') THEN
        ALTER TABLE payers
        ADD COLUMN allows_supervised BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added allows_supervised to payers';
    END IF;

    -- Add supervision_level if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'supervision_level') THEN
        ALTER TABLE payers
        ADD COLUMN supervision_level TEXT DEFAULT 'sign_off_only';
        RAISE NOTICE 'Added supervision_level to payers';
    END IF;

    -- Add updated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE payers
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at to payers';
    END IF;
END $$;

-- Add missing columns to provider_payer_networks table
DO $$
BEGIN
    -- Add notes column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'provider_payer_networks'
                   AND column_name = 'notes') THEN
        ALTER TABLE provider_payer_networks
        ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes to provider_payer_networks';
    END IF;

    -- Add created_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'provider_payer_networks'
                   AND column_name = 'created_at') THEN
        ALTER TABLE provider_payer_networks
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at to provider_payer_networks';
    END IF;

    -- Add updated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'provider_payer_networks'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE provider_payer_networks
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at to provider_payer_networks';
    END IF;
END $$;

-- ============================================
-- STEP 2: Create indexes for better performance (if they don't exist)
-- ============================================

-- Only create indexes if the columns exist
CREATE INDEX IF NOT EXISTS idx_supervision_payer
ON supervision_relationships(payer_id)
WHERE payer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supervision_active
ON supervision_relationships(is_active, start_date, end_date)
WHERE is_active IS NOT NULL;

-- ============================================
-- STEP 3: Add compatibility columns for dual naming support
-- ============================================

-- Add supervisor_provider_id as an alias to attending_provider_id if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'supervision_relationships'
               AND column_name = 'attending_provider_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'supervisor_provider_id') THEN

        -- Add supervisor_provider_id as a generated column that references attending_provider_id
        ALTER TABLE supervision_relationships
        ADD COLUMN supervisor_provider_id UUID GENERATED ALWAYS AS (attending_provider_id) STORED;
        RAISE NOTICE 'Added supervisor_provider_id as alias to attending_provider_id';
    END IF;

    -- Similarly for supervisee_provider_id
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'supervision_relationships'
               AND column_name = 'resident_provider_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'supervision_relationships'
                       AND column_name = 'supervisee_provider_id') THEN

        ALTER TABLE supervision_relationships
        ADD COLUMN supervisee_provider_id UUID GENERATED ALWAYS AS (resident_provider_id) STORED;
        RAISE NOTICE 'Added supervisee_provider_id as alias to resident_provider_id';
    END IF;
END $$;

-- ============================================
-- STEP 4: Create update trigger for timestamp (if not exists)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to payers if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'payers'
               AND column_name = 'updated_at') THEN
        DROP TRIGGER IF EXISTS update_payers_updated_at ON payers;
        CREATE TRIGGER update_payers_updated_at
            BEFORE UPDATE ON payers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Apply trigger to provider_payer_networks if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'provider_payer_networks'
               AND column_name = 'updated_at') THEN
        DROP TRIGGER IF EXISTS update_provider_payer_networks_updated_at ON provider_payer_networks;
        CREATE TRIGGER update_provider_payer_networks_updated_at
            BEFORE UPDATE ON provider_payer_networks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMIT;

-- ============================================
-- Verification queries (run these to check what was added)
-- ============================================
/*
-- Check what columns exist in supervision_relationships
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'supervision_relationships'
ORDER BY ordinal_position;

-- Check what columns exist in payers
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payers'
AND column_name IN ('allows_supervised', 'supervision_level', 'updated_at');

-- Check if we have both naming conventions
SELECT
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'supervision_relationships'
            AND column_name = 'attending_provider_id') as has_attending,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'supervision_relationships'
            AND column_name = 'supervisor_provider_id') as has_supervisor,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'supervision_relationships'
            AND column_name = 'resident_provider_id') as has_resident,
    EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name = 'supervision_relationships'
            AND column_name = 'supervisee_provider_id') as has_supervisee;
*/
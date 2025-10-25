-- Migration 021: Update supervision_relationships table for payer contract automation
-- This migration adds missing fields needed for comprehensive payer contract management

BEGIN;

-- First check if the table exists, if not create it with the complete schema
CREATE TABLE IF NOT EXISTS supervision_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supervisor_provider_id UUID NOT NULL REFERENCES providers(id),
    supervisee_provider_id UUID NOT NULL REFERENCES providers(id),
    payer_id UUID NOT NULL REFERENCES payers(id),
    supervision_type TEXT NOT NULL DEFAULT 'general',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    supervision_level TEXT DEFAULT 'sign_off_only' CHECK (supervision_level IN ('none', 'sign_off_only', 'first_visit_in_person', 'co_visit_required')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    CONSTRAINT no_self_supervision CHECK (supervisor_provider_id != supervisee_provider_id),
    CONSTRAINT unique_supervision_per_payer UNIQUE (supervisor_provider_id, supervisee_provider_id, payer_id, start_date)
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add supervisor_provider_id if not exists (might be named attending_provider_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'supervisor_provider_id') THEN

        -- Check if we have attending_provider_id and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'attending_provider_id') THEN
            ALTER TABLE supervision_relationships
            RENAME COLUMN attending_provider_id TO supervisor_provider_id;
        ELSE
            ALTER TABLE supervision_relationships
            ADD COLUMN supervisor_provider_id UUID REFERENCES providers(id);
        END IF;
    END IF;

    -- Add supervisee_provider_id if not exists (might be named resident_provider_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'supervisee_provider_id') THEN

        -- Check if we have resident_provider_id and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'resident_provider_id') THEN
            ALTER TABLE supervision_relationships
            RENAME COLUMN resident_provider_id TO supervisee_provider_id;
        ELSE
            ALTER TABLE supervision_relationships
            ADD COLUMN supervisee_provider_id UUID REFERENCES providers(id);
        END IF;
    END IF;

    -- Add payer_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'payer_id') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN payer_id UUID REFERENCES payers(id);
    END IF;

    -- Add supervision_type if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'supervision_type') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN supervision_type TEXT NOT NULL DEFAULT 'general';
    END IF;

    -- Add start_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'start_date') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;

    -- Add end_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'end_date') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN end_date DATE;
    END IF;

    -- Add is_active if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'is_active') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- Add supervision_level if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'supervision_level') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN supervision_level TEXT DEFAULT 'sign_off_only'
        CHECK (supervision_level IN ('none', 'sign_off_only', 'first_visit_in_person', 'co_visit_required'));
    END IF;

    -- Add notes if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'notes') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN notes TEXT;
    END IF;

    -- Add audit fields if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'created_by') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN created_by TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'supervision_relationships'
                   AND column_name = 'updated_by') THEN
        ALTER TABLE supervision_relationships
        ADD COLUMN updated_by TEXT;
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_supervision_payer ON supervision_relationships(payer_id);
CREATE INDEX IF NOT EXISTS idx_supervision_supervisor ON supervision_relationships(supervisor_provider_id);
CREATE INDEX IF NOT EXISTS idx_supervision_supervisee ON supervision_relationships(supervisee_provider_id);
CREATE INDEX IF NOT EXISTS idx_supervision_active ON supervision_relationships(is_active, start_date, end_date);

-- Add missing columns to payers table for supervision configuration
DO $$
BEGIN
    -- Add allows_supervised if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'allows_supervised') THEN
        ALTER TABLE payers
        ADD COLUMN allows_supervised BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add supervision_level if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'supervision_level') THEN
        ALTER TABLE payers
        ADD COLUMN supervision_level TEXT DEFAULT 'sign_off_only'
        CHECK (supervision_level IN (NULL, 'none', 'sign_off_only', 'first_visit_in_person', 'co_visit_required'));
    END IF;

    -- Add updated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payers'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE payers
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create a trigger to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to supervision_relationships
DROP TRIGGER IF EXISTS update_supervision_relationships_updated_at ON supervision_relationships;
CREATE TRIGGER update_supervision_relationships_updated_at
    BEFORE UPDATE ON supervision_relationships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to payers
DROP TRIGGER IF EXISTS update_payers_updated_at ON payers;
CREATE TRIGGER update_payers_updated_at
    BEFORE UPDATE ON payers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification queries (run these after migration to confirm success)
/*
-- Check supervision_relationships structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'supervision_relationships'
ORDER BY ordinal_position;

-- Check payers structure for supervision fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payers'
AND column_name IN ('allows_supervised', 'supervision_level', 'updated_at')
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'supervision_relationships';
*/
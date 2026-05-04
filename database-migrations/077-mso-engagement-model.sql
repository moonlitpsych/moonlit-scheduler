-- Migration 077: MSO Engagement Model
--
-- Adds the structural distinction between Moonlit's own contractors/employees
-- and external Management Services Organization (MSO) clients whose claims
-- Moonlit handles under its TIN/Group NPI in exchange for a revenue share.
--
-- Context: First MSO client is Donald "Andy" Godfrey, PhD (Godfrey Advanced
-- Psychological Services LLC), onboarded 2026-05-04. Decisions captured in
-- ~/.claude/plans/hello-for-this-conversation-velvet-patterson.md.
--
-- Run this in Supabase Dashboard SQL editor:
--   https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new
--
-- Idempotent: safe to re-run.

BEGIN;

-- 1. Enum: how a provider is engaged with Moonlit
DO $$ BEGIN
    CREATE TYPE provider_engagement_type AS ENUM (
        'moonlit_w2',     -- W-2 employee of Moonlit (future)
        'moonlit_1099',   -- 1099 contractor of Moonlit (current default)
        'mso_client'      -- External owner using Moonlit MSO services
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enum: what revenue basis the MSO % applies to
DO $$ BEGIN
    CREATE TYPE mso_revenue_basis AS ENUM (
        'gross_collections',                  -- insurer_paid + patient_paid
        'net_of_writeoffs',                   -- minus contractual writeoffs (no-op since insurer_paid is already post-writeoff)
        'net_of_writeoffs_and_fees'           -- minus processor fees too (recommended)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. business_entities: legal entities that issue claims or receive money.
--    Includes Moonlit itself plus any external MSO client.
CREATE TABLE IF NOT EXISTS business_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    legal_name TEXT NOT NULL,
    dba TEXT,
    entity_type TEXT,                          -- 'pllc', 'llc', 'sole_prop', 'pc', etc.
    ein TEXT,                                  -- federal EIN; nullable until obtained
    group_npi TEXT,                            -- organizational NPI (Type 2)
    state_entity_number TEXT,                  -- e.g., Utah Division of Corp filing number
    address TEXT,
    phone TEXT,
    fax TEXT,
    email TEXT,
    is_moonlit BOOLEAN NOT NULL DEFAULT FALSE, -- exactly one row should be true
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_entities_moonlit_singleton
    ON business_entities(is_moonlit) WHERE is_moonlit = TRUE;

-- 4. Provider columns: engagement type + optional FK to business entity + preferred name
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS engagement_type provider_engagement_type,
    ADD COLUMN IF NOT EXISTS business_entity_id UUID REFERENCES business_entities(id),
    ADD COLUMN IF NOT EXISTS preferred_name TEXT;

-- Backfill existing rows to moonlit_1099 (every provider today is a 1099 contractor)
UPDATE providers SET engagement_type = 'moonlit_1099' WHERE engagement_type IS NULL;

-- Now enforce NOT NULL
ALTER TABLE providers ALTER COLUMN engagement_type SET NOT NULL;
ALTER TABLE providers ALTER COLUMN engagement_type SET DEFAULT 'moonlit_1099';

CREATE INDEX IF NOT EXISTS idx_providers_engagement_type ON providers(engagement_type);
CREATE INDEX IF NOT EXISTS idx_providers_business_entity_id ON providers(business_entity_id);

-- 5. mso_engagements: terms of an MSO arrangement (1 active per provider expected)
CREATE TABLE IF NOT EXISTS mso_engagements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID NOT NULL REFERENCES providers(id),
    business_entity_id UUID NOT NULL REFERENCES business_entities(id),
    effective_date DATE,                       -- nullable: 'pending_activation' rows may not have one yet
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'pending_activation', -- 'pending_activation', 'active', 'paused', 'terminated'
    -- Engagement may only be 'active' once an effective_date is set (enforced below)
    revenue_share_pct NUMERIC(5,4) NOT NULL,   -- e.g., 0.7000 = 70% to provider
    revenue_basis mso_revenue_basis NOT NULL DEFAULT 'net_of_writeoffs_and_fees',
    services_included TEXT[] NOT NULL DEFAULT '{}', -- 'rcm','credentialing','patient_billing','office'
    settlement_cadence TEXT,                   -- 'monthly','biweekly','weekly'; null = monthly default
    office_terms JSONB,                        -- free-form: rent included? per-session? flat?
    msa_signed_date DATE,                      -- master services agreement signed
    msa_document_url TEXT,
    w9_on_file_url TEXT,
    malpractice_verified_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mso_engagements_pct_range CHECK (revenue_share_pct > 0 AND revenue_share_pct <= 1),
    CONSTRAINT mso_engagements_active_requires_effective_date
        CHECK (status <> 'active' OR effective_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mso_engagements_provider ON mso_engagements(provider_id);
CREATE INDEX IF NOT EXISTS idx_mso_engagements_status ON mso_engagements(status);

-- Only one active engagement per provider at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_mso_engagements_one_active_per_provider
    ON mso_engagements(provider_id) WHERE status = 'active';

-- 6. Seed Moonlit, PLLC as the first business_entities row
INSERT INTO business_entities (
    legal_name, entity_type, ein, group_npi, address, phone, fax, email, is_moonlit, notes
) VALUES (
    'Moonlit, PLLC',
    'pllc',
    '33-2185708',
    '1275348807',
    '1336 S 1100 E, Salt Lake City, UT 84105',
    '385-246-2522',
    '801-810-1343',
    'hello@trymoonlit.com',
    TRUE,
    'Primary operating entity. All claims for Moonlit-credentialed and MSO providers bill under this TIN/Group NPI.'
)
ON CONFLICT DO NOTHING;

COMMIT;

-- Verification queries (run after to confirm):
-- SELECT id, legal_name, ein, group_npi, is_moonlit FROM business_entities;
-- SELECT engagement_type, COUNT(*) FROM providers GROUP BY engagement_type;
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'providers' AND column_name IN ('engagement_type','business_entity_id','preferred_name');

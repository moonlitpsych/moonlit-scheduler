-- Migration 078: Seed first MSO client — Donald "Andy" Godfrey, PhD
--
-- Inserts:
--   1. Godfrey Advanced Psychological Services LLC into business_entities
--   2. Andy's provider record (inactive — not bookable yet)
--   3. A 'pending_activation' mso_engagement linking the two
--
-- The engagement has NO effective_date, NO MSA on file, and NO malpractice
-- verified — all required to flip status='active'. The provider row is
-- created with is_active=false, list_on_provider_page=false, and
-- accepts_new_patients=false; flip those when onboarding completes.
--
-- BLOCKERS to activation (track outside DB; flip status when each clears):
--   [ ] Andy's LLC EIN obtained (currently NULL in business_entities)
--   [ ] Master Services Agreement drafted, signed, msa_signed_date set
--   [ ] W9 received from the LLC, w9_on_file_url set
--   [ ] Malpractice insurance bound, certificate received, malpractice_verified_date set
--   [ ] Revenue share % confirmed (placeholder: 70%)
--   [ ] Settlement cadence confirmed (placeholder: monthly)
--   [ ] Office terms confirmed (placeholder: NULL)
--   [ ] effective_date set, status flipped to 'active'
--   [ ] Provider record activated (is_active, list_on_provider_page, accepts_new_patients)
--   [ ] Utah psychology license recorded in license table (license #13886997-2501)
--   [ ] Auth user provisioned (auth_user_id)
--   [ ] CAQH attestation up-to-date
--   [ ] Payer enrollments under Moonlit's group submitted
--
-- Idempotent: safe to re-run. Uses NPI 1548077837 as the natural key for the
-- provider row.
--
-- PREREQUISITE: 077-mso-engagement-model.sql must have run successfully.

BEGIN;

-- 1. Insert his business entity (idempotent on state_entity_number)
INSERT INTO business_entities (
    legal_name, dba, entity_type, ein, state_entity_number, address, phone, email, is_moonlit, notes
)
SELECT
    'Godfrey Advanced Psychological Services LLC',
    NULL,
    'llc',
    NULL,                                      -- EIN: pending; LLC formed 2026-04-22
    '14686997-0160',                           -- Utah Division of Corporations entity number
    '2979 Vista Circle, Bountiful, UT 84010',
    '801-828-6283',                            -- Andy's personal cell; LLC just formed
    'don.godfrey.5628@gmail.com',
    FALSE,
    'First MSO client. Onboarding initiated 2026-05-04. Pending: EIN, MSA, W9, malpractice.'
WHERE NOT EXISTS (
    SELECT 1 FROM business_entities WHERE state_entity_number = '14686997-0160'
);

-- 2. Insert Andy's provider record (idempotent on NPI)
INSERT INTO providers (
    first_name, last_name, preferred_name, title,
    npi, email, phone_number, fax_number,
    date_of_birth, location_of_birth, address,
    caqh_provider_id, languages_spoken,
    med_school_org, med_school_grad_year, residency_org,
    is_active, list_on_provider_page, accepts_new_patients, availability, is_bookable,
    profile_completed, telehealth_enabled,
    engagement_type, business_entity_id,
    created_date, modified_date
)
SELECT
    'Donald', 'Godfrey', 'Andy', 'PhD',
    '1548077837',
    'don.godfrey.5628@gmail.com',
    '801-828-6283',
    NULL,
    DATE '1993-07-08', 'Salt Lake City, UT', '2979 Vista Circle, Bountiful, UT 84010',
    '16381084',
    ARRAY['English'],
    'University of Houston', 2023, 'University of Utah',
    FALSE, FALSE, FALSE, FALSE, FALSE,         -- not bookable until onboarding completes
    FALSE, NULL,
    'mso_client', be.id,
    NOW(), NOW()
FROM business_entities be
WHERE be.legal_name = 'Godfrey Advanced Psychological Services LLC'
  AND NOT EXISTS (SELECT 1 FROM providers WHERE npi = '1548077837');

-- 3. If Andy already existed, just update the engagement-related fields and link.
UPDATE providers p
SET
    engagement_type = 'mso_client',
    business_entity_id = be.id,
    preferred_name = COALESCE(p.preferred_name, 'Andy'),
    modified_date = NOW()
FROM business_entities be
WHERE p.npi = '1548077837'
  AND be.legal_name = 'Godfrey Advanced Psychological Services LLC'
  AND (p.engagement_type IS DISTINCT FROM 'mso_client'
       OR p.business_entity_id IS DISTINCT FROM be.id);

-- 4. Create the engagement row in 'pending_activation' (no effective_date, no MSA)
INSERT INTO mso_engagements (
    provider_id, business_entity_id, effective_date, status,
    revenue_share_pct, revenue_basis, services_included, settlement_cadence,
    notes
)
SELECT
    p.id,
    be.id,
    NULL,                                      -- effective_date: pending contract
    'pending_activation',
    0.7000,                                    -- 70% placeholder, confirm with Andy before flipping to active
    'net_of_writeoffs_and_fees',
    ARRAY['rcm','credentialing','patient_billing','office'],
    'monthly',                                 -- placeholder cadence
    'Initial engagement record. Activate by setting effective_date, msa_signed_date, malpractice_verified_date and status=active.'
FROM providers p, business_entities be
WHERE p.npi = '1548077837'
  AND be.legal_name = 'Godfrey Advanced Psychological Services LLC'
  AND NOT EXISTS (
      SELECT 1 FROM mso_engagements me WHERE me.provider_id = p.id
  );

COMMIT;

-- Verification:
-- SELECT p.first_name, p.last_name, p.preferred_name, p.title, p.npi, p.engagement_type,
--        be.legal_name, be.state_entity_number, be.ein
--   FROM providers p
--   LEFT JOIN business_entities be ON be.id = p.business_entity_id
--   WHERE p.npi = '1548077837';
-- SELECT status, revenue_share_pct, revenue_basis, services_included, effective_date, settlement_cadence
--   FROM mso_engagements
--   WHERE provider_id = (SELECT id FROM providers WHERE npi = '1548077837');

-- Migration 078: Seed first MSO client — Donald "Andy" Godfrey, PhD
--
-- Inserts Godfrey Advanced Psychological Services LLC into business_entities
-- and creates a 'pending_activation' mso_engagement linking it to Andy's
-- provider record. The engagement has NO effective_date, NO MSA on file, and
-- NO malpractice verified — all of which are required to flip status='active'.
--
-- BLOCKERS to activation (track outside DB; flip status when each clears):
--   [ ] Andy's LLC EIN obtained (currently NULL in business_entities)
--   [ ] Master Services Agreement drafted, signed, msa_signed_date set
--   [ ] W9 received from the LLC, w9_on_file_url set
--   [ ] Malpractice insurance bound, certificate received, malpractice_verified_date set
--   [ ] Revenue share % confirmed (placeholder: 70%)
--   [ ] Settlement cadence confirmed (placeholder: monthly)
--   [ ] Office terms confirmed (placeholder: NULL)
--   [ ] effective_date set
--
-- Idempotent: safe to re-run.
--
-- PREREQUISITE: 077-mso-engagement-model.sql must have run successfully.
-- PREREQUISITE: Andy must already have a row in `providers` (NPI 1548077837).
--   If he does NOT, create the provider record via your normal onboarding flow
--   first, then re-run this migration.

BEGIN;

-- 1. Insert his business entity
INSERT INTO business_entities (
    legal_name, dba, entity_type, ein, state_entity_number, address, phone, email, is_moonlit, notes
) VALUES (
    'Godfrey Advanced Psychological Services LLC',
    NULL,
    'llc',
    NULL,                                      -- EIN: pending; LLC formed 2026-04-22
    '14686997-0160',                           -- Utah Division of Corporations entity number
    '2979 Vista Circle, Bountiful, UT 84010',
    '801-828-6283',                            -- Andy's personal cell; LLC just formed, no separate line
    'don.godfrey.5628@gmail.com',
    FALSE,
    'First MSO client. Onboarding initiated 2026-05-04. Pending: EIN, MSA, W9, malpractice.'
)
ON CONFLICT DO NOTHING;

-- 2. Update Andy's provider record: tag as MSO client, link to his LLC, set preferred name.
--    Lookup by individual NPI to avoid relying on internal id.
UPDATE providers p
SET
    engagement_type = 'mso_client',
    business_entity_id = be.id,
    preferred_name = COALESCE(p.preferred_name, 'Andy'),
    modified_date = NOW()
FROM business_entities be
WHERE p.npi = '1548077837'
  AND be.legal_name = 'Godfrey Advanced Psychological Services LLC';

-- 3. Create the engagement row in 'pending_activation' (no effective_date, no MSA)
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
-- SELECT p.first_name, p.last_name, p.preferred_name, p.engagement_type, be.legal_name, be.ein
--   FROM providers p
--   LEFT JOIN business_entities be ON be.id = p.business_entity_id
--   WHERE p.npi = '1548077837';
-- SELECT * FROM mso_engagements WHERE provider_id = (SELECT id FROM providers WHERE npi = '1548077837');

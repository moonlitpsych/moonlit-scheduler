-- Migration 086c: Link Optum Tooele orgs → payer, care types, specialty tags
--
-- Run order: 086 (catalog seed) → 086a (dedupe report, manual review) →
--            086b (org inserts/updates) → 086c (this file).
--
-- Idempotent: every INSERT uses WHERE NOT EXISTS so re-running is a no-op.
-- All organization references are by lower(trim(name)) so this works whether
-- 086b inserted the row or 086a's review pointed it at a pre-existing row
-- (assuming the existing row's name is canonical; if not, edit the name list
-- in this file).
--
-- Source: Optum Tooele County Provider Resource Guide, rev 3.26.2026.

BEGIN;

-- Convenience: payer id constant (avoid retyping)
-- Optum Medicaid: 67352284-5037-4514-8663-99859ff8b06b

-- ============================================================================
-- 1. organization_accepted_payers — link every org in the guide to Optum Medicaid
-- ============================================================================

INSERT INTO organization_accepted_payers (organization_id, payer_id, is_active, verification_date, verified_by, notes)
SELECT
  o.id,
  '67352284-5037-4514-8663-99859ff8b06b'::uuid,
  true,
  CURRENT_DATE,
  'Optum Tooele County Provider Resource Guide rev 3.26.2026',
  CASE
    WHEN lower(trim(o.name)) = 'cornerstone counseling center' THEN 'LAI: Clozaril yes, Relprevv NO'
    ELSE NULL
  END
FROM organizations o
WHERE lower(trim(o.name)) IN (
  'valley behavioral health','volunteers of america utah','cornerstone counseling center',
  'lotus center inc','dynamic psychiatry','bonneville family practice','blue willow psychiatry',
  'project connection','reach counseling','beacon house','moving forward counseling',
  'clinical consultants','odyssey house','turning point - mountain view residential treatment',
  'valley core','valley steps','altium health','amethyst center for healing',
  'bears ears child and family therapy','first step house','gcs foundation','hopeful beginnings',
  'journey llc','lumos enterprises','multicultural counseling center','project reality',
  'silverado counseling services',
  'university of utah medical center department psychiatry-assessment & referral services',
  'utah harm reduction coalition','wasatch behavioral health',
  'assessment and referral services (ars)','aspen ridge counseling','house of hope',
  'precipice counseling','tranquility place','true north recovery and wellness center',
  'aspire academy','voa homeless youth','jjs youth services'
)
AND NOT EXISTS (
  SELECT 1 FROM organization_accepted_payers oap
  WHERE oap.organization_id = o.id
    AND oap.payer_id = '67352284-5037-4514-8663-99859ff8b06b'::uuid
);

-- ============================================================================
-- 2. organization_care_types — link orgs to program types
-- ============================================================================

-- Helper macro implemented as a repeated pattern below. Each block:
--   INSERT ... SELECT o.id, ct.id FROM organizations o, referral_care_types ct
--   WHERE ct.name = '<care_type_name>'
--     AND lower(trim(o.name)) IN (<org name list>)
--     AND NOT EXISTS (...)

-- med_management_lai (PDF page 4 table)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'med_management_lai'
  AND lower(trim(o.name)) IN (
    'valley behavioral health','volunteers of america utah','cornerstone counseling center',
    'lotus center inc','dynamic psychiatry','bonneville family practice','blue willow psychiatry'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- adult_iop
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'adult_iop'
  AND lower(trim(o.name)) IN ('reach counseling','beacon house','moving forward counseling','clinical consultants')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- adult_residential
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'adult_residential'
  AND lower(trim(o.name)) IN (
    'odyssey house','turning point - mountain view residential treatment','valley core','valley steps'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- adult_case_management (PDF pages 7-8 table)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'adult_case_management'
  AND lower(trim(o.name)) IN (
    'altium health','amethyst center for healing','bears ears child and family therapy',
    'clinical consultants','first step house','gcs foundation','hopeful beginnings',
    'journey llc','lotus center inc','lumos enterprises','moving forward counseling',
    'multicultural counseling center','project connection','project reality',
    'silverado counseling services',
    'university of utah medical center department psychiatry-assessment & referral services',
    'utah harm reduction coalition','valley behavioral health','volunteers of america utah',
    'wasatch behavioral health','beacon house'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- sud_assessment (eval-only or eval+other)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'sud_assessment'
  AND lower(trim(o.name)) IN (
    'assessment and referral services (ars)','clinical consultants','odyssey house','project reality',
    'true north recovery and wellness center','house of hope','wasatch behavioral health',
    'volunteers of america utah','valley behavioral health',
    'university of utah medical center department psychiatry-assessment & referral services'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- sud_outpatient (ASAM 1.0)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'sud_outpatient'
  AND lower(trim(o.name)) IN (
    'aspen ridge counseling','bonneville family practice','tranquility place',
    'true north recovery and wellness center','beacon house','clinical consultants','odyssey house',
    'project reality','precipice counseling','utah harm reduction coalition',
    'valley behavioral health','volunteers of america utah','cornerstone counseling center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- sud_iop (ASAM 2.1)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'sud_iop'
  AND lower(trim(o.name)) IN (
    'beacon house','clinical consultants','odyssey house','utah harm reduction coalition',
    'valley behavioral health','volunteers of america utah','cornerstone counseling center',
    'house of hope'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- sud_residential (ASAM 3.x)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'sud_residential'
  AND lower(trim(o.name)) IN (
    'odyssey house','house of hope','valley behavioral health'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- sud_detox
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'sud_detox'
  AND lower(trim(o.name)) IN (
    'volunteers of america utah','cornerstone counseling center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- mat_clinic
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'mat_clinic'
  AND lower(trim(o.name)) IN (
    'bonneville family practice','clinical consultants','odyssey house','project reality',
    'tranquility place','true north recovery and wellness center','utah harm reduction coalition',
    'volunteers of america utah','cornerstone counseling center','wasatch behavioral health'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- youth_day_treatment (Hopeful Beginnings; VBH day treatment runs out of Valley BH)
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'youth_day_treatment'
  AND lower(trim(o.name)) IN ('hopeful beginnings','valley behavioral health')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- youth_iop
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'youth_iop'
  AND lower(trim(o.name)) IN ('reach counseling','lumos enterprises')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- youth_php
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'youth_php'
  AND lower(trim(o.name)) IN ('lumos enterprises')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- youth_residential
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'youth_residential'
  AND lower(trim(o.name)) IN ('aspire academy','odyssey house')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- youth_homeless_services
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'youth_homeless_services'
  AND lower(trim(o.name)) IN ('voa homeless youth')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- high_fidelity_wraparound
INSERT INTO organization_care_types (organization_id, care_type_id, is_active)
SELECT o.id, ct.id, true
FROM organizations o
CROSS JOIN referral_care_types ct
WHERE ct.name = 'high_fidelity_wraparound'
  AND lower(trim(o.name)) IN ('jjs youth services')
  AND NOT EXISTS (SELECT 1 FROM organization_care_types x WHERE x.organization_id = o.id AND x.care_type_id = ct.id);

-- ============================================================================
-- 3. organization_specialties — clinical / population / administrative tags
-- ============================================================================

-- accepts_optum_medicaid — every org in the guide
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'accepts_optum_medicaid'
  AND lower(trim(o.name)) IN (
    'valley behavioral health','volunteers of america utah','cornerstone counseling center',
    'lotus center inc','dynamic psychiatry','bonneville family practice','blue willow psychiatry',
    'project connection','reach counseling','beacon house','moving forward counseling',
    'clinical consultants','odyssey house','turning point - mountain view residential treatment',
    'valley core','valley steps','altium health','amethyst center for healing',
    'bears ears child and family therapy','first step house','gcs foundation','hopeful beginnings',
    'journey llc','lumos enterprises','multicultural counseling center','project reality',
    'silverado counseling services',
    'university of utah medical center department psychiatry-assessment & referral services',
    'utah harm reduction coalition','wasatch behavioral health',
    'assessment and referral services (ars)','aspen ridge counseling','house of hope',
    'precipice counseling','tranquility place','true north recovery and wellness center',
    'aspire academy','voa homeless youth','jjs youth services'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- medicare_provider (explicitly noted in guide pages 9, 11)
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'medicare_provider'
  AND lower(trim(o.name)) IN (
    'assessment and referral services (ars)','clinical consultants','odyssey house',
    'project reality','valley behavioral health',
    'university of utah medical center department psychiatry-assessment & referral services'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- requires_clinician_referral (Youth HLOC per page 12 preamble + Lumos exclusions)
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'requires_clinician_referral'
  AND lower(trim(o.name)) IN (
    'aspire academy','hopeful beginnings','lumos enterprises','reach counseling','valley behavioral health'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- tooele_county_inpatient_discharge — orgs with a Tooele physical address
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'tooele_county_inpatient_discharge'
  AND lower(trim(o.name)) IN (
    'beacon house','bonneville family practice','bears ears child and family therapy',
    'clinical consultants','precipice counseling'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- ─── Population tags ────────────────────────────────────────────────────────

-- adults
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'adults'
  AND lower(trim(o.name)) IN (
    'project connection','reach counseling','beacon house','moving forward counseling',
    'clinical consultants','odyssey house','turning point - mountain view residential treatment',
    'valley core','valley steps','assessment and referral services (ars)','aspen ridge counseling',
    'house of hope','precipice counseling','tranquility place','true north recovery and wellness center',
    'utah harm reduction coalition','volunteers of america utah','cornerstone counseling center',
    'valley behavioral health','project reality','bonneville family practice','wasatch behavioral health',
    'lotus center inc','dynamic psychiatry','blue willow psychiatry'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- youth_12_17
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'youth_12_17'
  AND lower(trim(o.name)) IN (
    'hopeful beginnings','valley behavioral health','lumos enterprises','reach counseling',
    'aspire academy','odyssey house','clinical consultants','precipice counseling',
    'wasatch behavioral health'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- children_5_11 (Lumos KIDS 5-11, ACES 5-12)
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'children_5_11'
  AND lower(trim(o.name)) IN ('lumos enterprises','valley behavioral health')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- women_only
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'women_only'
  AND lower(trim(o.name)) IN ('house of hope')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- women_with_children
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'women_with_children'
  AND lower(trim(o.name)) IN (
    'house of hope','volunteers of america utah','valley behavioral health','odyssey house'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- co_occurring_criminal_justice
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'co_occurring_criminal_justice'
  AND lower(trim(o.name)) IN ('valley core')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- homeless_youth_15_22
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'homeless_youth_15_22'
  AND lower(trim(o.name)) IN ('voa homeless youth')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- perinatal (Reach Counseling — perinatal yoga)
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'perinatal'
  AND lower(trim(o.name)) IN ('reach counseling')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- female_adolescent_only
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'female_adolescent_only'
  AND lower(trim(o.name)) IN ('aspire academy')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- ─── Clinical tags ─────────────────────────────────────────────────────────

-- co_occurring_mh_sud
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'co_occurring_mh_sud'
  AND lower(trim(o.name)) IN (
    'odyssey house','valley core','beacon house','turning point - mountain view residential treatment'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- clozaril_capable
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'clozaril_capable'
  AND lower(trim(o.name)) IN ('volunteers of america utah','cornerstone counseling center')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- relprevv_capable (VOA only — Cornerstone explicitly no)
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'relprevv_capable'
  AND lower(trim(o.name)) IN ('volunteers of america utah')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- ASAM levels
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_1_0'
  AND lower(trim(o.name)) IN (
    'aspen ridge counseling','beacon house','bonneville family practice','clinical consultants',
    'house of hope','odyssey house','precipice counseling','project reality','tranquility place',
    'true north recovery and wellness center','utah harm reduction coalition','valley behavioral health',
    'volunteers of america utah','cornerstone counseling center','wasatch behavioral health'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_2_1'
  AND lower(trim(o.name)) IN (
    'beacon house','clinical consultants','house of hope','odyssey house',
    'utah harm reduction coalition','valley behavioral health',
    'volunteers of america utah','cornerstone counseling center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_2_5'
  AND lower(trim(o.name)) IN (
    'beacon house','house of hope','odyssey house','utah harm reduction coalition',
    'valley behavioral health','volunteers of america utah','cornerstone counseling center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_3_1'
  AND lower(trim(o.name)) IN ('odyssey house','valley behavioral health')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_3_3'
  AND lower(trim(o.name)) IN ('odyssey house')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'asam_3_5'
  AND lower(trim(o.name)) IN ('house of hope','odyssey house','valley behavioral health')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

-- MAT meds
INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_suboxone'
  AND lower(trim(o.name)) IN (
    'clinical consultants','odyssey house','project reality',
    'volunteers of america utah','cornerstone counseling center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_subutex'
  AND lower(trim(o.name)) IN ('clinical consultants','odyssey house')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_methadone'
  AND lower(trim(o.name)) IN (
    'bonneville family practice','odyssey house','project reality','tranquility place',
    'true north recovery and wellness center'
  )
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_vivitrol'
  AND lower(trim(o.name)) IN ('odyssey house','true north recovery and wellness center')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_naltrexone'
  AND lower(trim(o.name)) IN ('clinical consultants','odyssey house','project reality')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

INSERT INTO organization_specialties (organization_id, specialty_tag_id, is_active)
SELECT o.id, st.id, true
FROM organizations o
CROSS JOIN referral_specialty_tags st
WHERE st.name = 'mat_buprenorphine'
  AND lower(trim(o.name)) IN ('odyssey house','true north recovery and wellness center')
  AND NOT EXISTS (SELECT 1 FROM organization_specialties x WHERE x.organization_id = o.id AND x.specialty_tag_id = st.id);

COMMIT;

-- Verification:
-- 1. All guide orgs are linked to Optum Medicaid:
--    SELECT count(*) FROM organization_accepted_payers
--    WHERE payer_id = '67352284-5037-4514-8663-99859ff8b06b'::uuid AND is_active;
--
-- 2. Spot check: who offers methadone MAT?
--    SELECT o.name FROM organizations o
--    JOIN organization_specialties os ON os.organization_id = o.id
--    JOIN referral_specialty_tags st ON st.id = os.specialty_tag_id
--    WHERE st.name = 'mat_methadone' ORDER BY o.name;
--    -- expect: Bonneville Family Practice, Odyssey House, Project Reality, Tranquility Place, True North
--
-- 3. Spot check: who offers Adult IOP?
--    SELECT o.name FROM organizations o
--    JOIN organization_care_types oct ON oct.organization_id = o.id
--    JOIN referral_care_types ct ON ct.id = oct.care_type_id
--    WHERE ct.name = 'adult_iop' ORDER BY o.name;
--    -- expect: Beacon House, Clinical Consultants, Moving Forward Counseling, Reach Counseling

-- Migration 086: Seed referral_care_types and referral_specialty_tags catalogs
--
-- Context: The referral catalog tables exist but have no seed data. We're about
-- to ingest ~40 organizations from the Optum Tooele County Provider Resource
-- Guide (rev 3.26.2026), and the search/filter UI needs program types and
-- clinical/population/administrative tags to filter on. This migration seeds
-- both catalogs with the full set of values implied by the guide.
--
-- Idempotent: uses WHERE NOT EXISTS guards on the natural key (`name`), so
-- re-running is a no-op.

BEGIN;

-- ============================================================================
-- referral_care_types — program types / levels of care
-- ============================================================================
INSERT INTO referral_care_types (name, display_name, description, display_order, is_active)
SELECT * FROM (VALUES
  ('med_management_lai',       'Medication Management & LAI',                'Outpatient psychiatric medication management, including long-acting injectables.', 10, true),
  ('adult_iop',                'Adult IOP',                                  'Adult intensive outpatient program (mental health).',                              20, true),
  ('adult_php',                'Adult PHP',                                  'Adult partial hospitalization program.',                                            21, true),
  ('adult_residential',        'Adult Residential',                          'Adult residential treatment (MH and/or co-occurring SUD).',                        30, true),
  ('adult_case_management',    'Adult Case Management',                      'Adult case management / care coordination services.',                              40, true),
  ('sud_assessment',           'SUD / MH Assessment',                        'Substance use and mental health assessments and evaluations.',                     50, true),
  ('sud_outpatient',           'SUD Outpatient',                             'Substance use outpatient treatment (ASAM 1.0).',                                   51, true),
  ('sud_iop',                  'SUD IOP',                                    'Substance use intensive outpatient (ASAM 2.1).',                                   52, true),
  ('sud_residential',          'SUD Residential',                            'Substance use residential treatment (ASAM 3.x).',                                  53, true),
  ('sud_detox',                'SUD Detox',                                  'Social or medical substance use detoxification.',                                  54, true),
  ('mat_clinic',               'MAT (Medication-Assisted Treatment)',        'Medication-assisted treatment for opioid / substance use disorder.',               55, true),
  ('youth_day_treatment',      'Youth Day Treatment',                        'Full-day treatment program for children and adolescents.',                         60, true),
  ('youth_iop',                'Youth IOP',                                  'Intensive outpatient program for youth.',                                          61, true),
  ('youth_php',                'Youth PHP',                                  'Partial hospitalization program for youth.',                                       62, true),
  ('youth_residential',        'Youth Residential',                          'Youth residential treatment.',                                                     63, true),
  ('youth_homeless_services',  'Youth Homeless Services',                    'Shelter, meals, and case management for homeless and at-risk youth.',              70, true),
  ('high_fidelity_wraparound', 'High-Fidelity Wraparound (HFW)',             'System of Care High-Fidelity Wraparound for youth with complex needs.',            71, true)
) AS new_rows(name, display_name, description, display_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM referral_care_types existing WHERE existing.name = new_rows.name
);

-- ============================================================================
-- referral_specialty_tags — clinical / population / administrative
-- ============================================================================
INSERT INTO referral_specialty_tags (name, display_name, description, tag_category, display_order, is_active)
SELECT * FROM (VALUES
  -- Clinical: ASAM levels of care
  ('asam_1_0',                       'ASAM 1.0 (Outpatient)',                  'ASAM Level 1.0 — outpatient services.',                                      'clinical',       100, true),
  ('asam_2_1',                       'ASAM 2.1 (IOP)',                          'ASAM Level 2.1 — intensive outpatient.',                                    'clinical',       101, true),
  ('asam_2_5',                       'ASAM 2.5 (PHP)',                          'ASAM Level 2.5 — partial hospitalization.',                                 'clinical',       102, true),
  ('asam_3_1',                       'ASAM 3.1 (Clinically Managed Low)',       'ASAM Level 3.1 — clinically managed low-intensity residential.',            'clinical',       103, true),
  ('asam_3_3',                       'ASAM 3.3 (Population-Specific Residential)','ASAM Level 3.3 — clinically managed population-specific high-intensity.', 'clinical',       104, true),
  ('asam_3_5',                       'ASAM 3.5 (High-Intensity Residential)',   'ASAM Level 3.5 — clinically managed high-intensity residential.',           'clinical',       105, true),
  -- Clinical: MAT medications
  ('mat_suboxone',                   'MAT: Suboxone',                           'Offers Suboxone for opioid use disorder.',                                  'clinical',       110, true),
  ('mat_subutex',                    'MAT: Subutex',                            'Offers Subutex (buprenorphine) for OUD.',                                   'clinical',       111, true),
  ('mat_methadone',                  'MAT: Methadone',                          'Offers methadone (OTP).',                                                   'clinical',       112, true),
  ('mat_vivitrol',                   'MAT: Vivitrol',                           'Offers Vivitrol (naltrexone XR).',                                          'clinical',       113, true),
  ('mat_naltrexone',                 'MAT: Naltrexone',                         'Offers naltrexone (oral).',                                                 'clinical',       114, true),
  ('mat_buprenorphine',              'MAT: Buprenorphine',                      'Offers buprenorphine formulations.',                                        'clinical',       115, true),
  -- Clinical: other
  ('co_occurring_mh_sud',            'Co-occurring MH + SUD',                   'Treats co-occurring mental health and substance use disorders.',            'clinical',       120, true),
  ('clozaril_capable',               'Clozaril-capable',                        'Can manage Clozaril (clozapine) prescriptions and monitoring.',             'clinical',       121, true),
  ('relprevv_capable',               'Relprevv-capable',                        'Can administer Relprevv (olanzapine LAI).',                                 'clinical',       122, true),
  -- Population: ages and identities served
  ('adults',                         'Adults',                                  'Serves adults (18+).',                                                      'population',     200, true),
  ('youth_12_17',                    'Youth ages 12–17',                        'Serves adolescents ages 12–17.',                                            'population',     201, true),
  ('children_5_11',                  'Children ages 5–11',                      'Serves children ages 5–11.',                                                'population',     202, true),
  ('women_only',                     'Women only',                              'Serves women only.',                                                        'population',     203, true),
  ('women_with_children',            'Women with children',                     'Programs for women with their children.',                                   'population',     204, true),
  ('co_occurring_criminal_justice',  'Co-occurring + criminal justice involved','Programs for justice-involved adults with co-occurring disorders.',         'population',     205, true),
  ('homeless_youth_15_22',           'Homeless youth ages 15–22',               'Serves homeless and at-risk youth ages 15–22.',                             'population',     206, true),
  ('perinatal',                      'Perinatal',                               'Perinatal services (pregnancy / postpartum).',                              'population',     207, true),
  ('female_adolescent_only',         'Female adolescents only',                 'Adolescent female-only programming.',                                       'population',     208, true),
  -- Administrative: intake / access notes
  ('accepts_optum_medicaid',         'Accepts Optum Medicaid',                  'Listed as in-network on the Optum Tooele County provider resource guide.',  'administrative', 300, true),
  ('medicare_provider',              'Medicare provider',                       'Also enrolled as a Medicare provider.',                                     'administrative', 301, true),
  ('requires_clinician_referral',    'Requires clinician referral',             'Cannot self-refer — clinician must initiate the referral.',                 'administrative', 302, true),
  ('tooele_county_inpatient_discharge','Tooele inpatient-discharge resource',   'Listed in the Tooele County Provider Resource Guide for inpatient discharge planning.','administrative',303,true)
) AS new_rows(name, display_name, description, tag_category, display_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM referral_specialty_tags existing WHERE existing.name = new_rows.name
);

COMMIT;

-- Quick verification queries (run separately):
-- SELECT count(*) FROM referral_care_types WHERE is_active;
-- SELECT tag_category, count(*) FROM referral_specialty_tags WHERE is_active GROUP BY tag_category ORDER BY tag_category;

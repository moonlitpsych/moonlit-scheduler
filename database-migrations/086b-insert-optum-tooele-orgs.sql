-- Migration 086b: Insert/upsert organizations from Optum Tooele guide
--
-- Source: Optum Tooele County Provider Resource Guide, rev 3.26.2026.
--
-- Dedupe results (from 086a, run 2026-05-26):
--   EXACT matches → UPDATE (fill blanks only, never overwrite):
--     - First Step House           c621d896-de55-4ea7-84c2-a01502249e82
--     - House of Hope              b099887f-8464-4ae3-8ea0-49c2beb3d6dc
--     - Moving Forward Counseling  f864e1c2-6f01-4b90-bce4-44b9dfb87e8a
--     - Project Reality            5182f346-d3d8-4833-8fe2-e666e2537d6d
--     - Valley Behavioral Health   bef601f7-2635-42f2-94e8-2678bd69814b
--     - Wasatch Behavioral Health  6bf76ef1-c5ed-4c4c-936c-1b66de8ef715
--   FUZZY matches → INSERT NEW (per user decision):
--     - 'Odyssey House' inserted as umbrella parent; existing 'Martindale
--       Clinic (Odyssey House)' (fd12742e-…) left untouched as sub-location.
--     - 'VOA Homeless Youth' inserted as distinct youth program; existing
--       'VOA' (e83482fb-…) left untouched.
--   All other orgs → INSERT (guarded by WHERE NOT EXISTS on lower(trim(name))).
--
-- Pattern notes:
--   - UPDATEs use COALESCE(existing, new) so non-NULL existing fields are
--     preserved; only blanks get filled.
--   - INSERTs use WHERE NOT EXISTS so re-running is a no-op.

BEGIN;

-- ============================================================================
-- UPDATES for the 6 exact matches (fill blanks only)
-- ============================================================================

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '801-359-8862'),
  fax                     = COALESCE(fax, '801-359-8510'),
  address                 = COALESCE(address, '411 N Grant Street'),
  city                    = COALESCE(city, 'Salt Lake City'),
  state                   = COALESCE(state, 'UT'),
  postal_code             = COALESCE(postal_code, '84116'),
  referral_notes          = COALESCE(referral_notes,
    'Adult case management. Discharged/long-gap members: Matt Croft, MBA (Admissions Manager) ext 2129. Short hospital stays still enrolled: Melissa Guest RN BSN ext 2111 / mobile 801-505-8294.'),
  updated_at              = now()
WHERE id = 'c621d896-de55-4ea7-84c2-a01502249e82';

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '801-487-3276'),
  address                 = COALESCE(address, '857 East 200 South'),
  city                    = COALESCE(city, 'Salt Lake City'),
  state                   = COALESCE(state, 'UT'),
  postal_code             = COALESCE(postal_code, '84102'),
  referral_notes          = COALESCE(referral_notes,
    'Adult women only. Evaluations, women with children, ASAM 1.0, 2.1, 2.5, 3.5.'),
  updated_at              = now()
WHERE id = 'b099887f-8464-4ae3-8ea0-49c2beb3d6dc';

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '801-810-5037'),
  address                 = COALESCE(address, '9844 S 1300 E Ste 250'),
  city                    = COALESCE(city, 'Sandy'),
  state                   = COALESCE(state, 'UT'),
  postal_code             = COALESCE(postal_code, '84094'),
  referral_notes          = COALESCE(referral_notes,
    'Adult IOP — 4 days/week group + 1 individual session/week. Individual therapy, group therapy, medication management.'),
  updated_at              = now()
WHERE id = 'f864e1c2-6f01-4b90-bce4-44b9dfb87e8a';

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '385-881-0170'),
  address                 = COALESCE(address, '667 S 700 E'),
  city                    = COALESCE(city, 'Salt Lake City'),
  state                   = COALESCE(state, 'UT'),
  postal_code             = COALESCE(postal_code, '84102'),
  referral_notes          = COALESCE(referral_notes,
    'Adult case management AND adult-only SUD: ASAM OTP (1.0), MAT (Suboxone, Naltrexone, Methadone). Second site: 150 East 700 South SLC 84111 (801-364-8080). Third site: 5280 S Commerce Dr Suite DI 10, Murray UT 84107. Medicare provider.'),
  updated_at              = now()
WHERE id = '5182f346-d3d8-4833-8fe2-e666e2537d6d';

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '888-949-4864'),
  website                 = COALESCE(website, 'https://valleycares.com/'),
  referral_notes          = COALESCE(referral_notes,
    'Salt Lake and Tooele Medicaid. Provides therapy services. Med management & LAI. Also operates VBH day treatment programs (AIM/DBT/KIDS/ACES) at 3737 W 4100 S STE 100 West Valley City UT 84120 — referrals: daytreatmentreferrals@valleycares.com / 801-565-9600.'),
  updated_at              = now()
WHERE id = 'bef601f7-2635-42f2-94e8-2678bd69814b';

UPDATE organizations SET
  is_referral_destination = true,
  phone                   = COALESCE(phone, '801-960-1680'),
  address                 = COALESCE(address, '371 S Vineyard Road'),
  city                    = COALESCE(city, 'Orem'),
  state                   = COALESCE(state, 'UT'),
  postal_code             = COALESCE(postal_code, '84058'),
  referral_notes          = COALESCE(referral_notes,
    'Adult case management AND adult SUD program at 255 South Orem Blvd, Orem 84058 (385-268-5000): urinalysis lab, assessments, full range SUD program, MAT. Youth: UA lab, assessment, outpatient SUD treatment. Operates Aspire Academy (see separate row).'),
  updated_at              = now()
WHERE id = '6bf76ef1-c5ed-4c4c-936c-1b66de8ef715';

-- ============================================================================
-- INSERTs for the 33 new orgs (guarded by WHERE NOT EXISTS on lower(trim(name)))
-- ============================================================================

-- ============================================================================
-- Medication Management & LAI (PDF page 4)
-- ============================================================================

-- Valley Behavioral Health → handled by UPDATE above (bef601f7-…)

INSERT INTO organizations (name, type, phone, is_referral_destination, referral_notes)
SELECT 'Volunteers of America Utah', 'referral_destination', '801-355-1528', true,
       'All LAIs including Clozaril and Relprevv. Provides therapy services.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Volunteers of America Utah')));

INSERT INTO organizations (name, type, is_referral_destination, referral_notes)
SELECT 'Cornerstone Counseling Center', 'referral_destination', true,
       'LAI: Clozaril yes, no Relprevv. (Listed under VOA contact on Optum Tooele guide page 4.)'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Cornerstone Counseling Center')));

INSERT INTO organizations (name, type, phone, website, is_referral_destination, referral_notes)
SELECT 'Lotus Center Inc', 'referral_destination', '385-272-4292', 'The Lotus Center – Integrative Therapy', true,
       'Salt Lake and Tooele Medicaid. Provides therapy services. Med management & LAI.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Lotus Center Inc')));

INSERT INTO organizations (name, type, phone, website, is_referral_destination, referral_notes)
SELECT 'Dynamic Psychiatry', 'referral_destination', '801-349-2480', 'Dynamic Psychiatry', true,
       'Salt Lake and Tooele Medicaid. Med management & LAI only (no therapy).'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Dynamic Psychiatry')));

INSERT INTO organizations (name, type, phone, website, is_referral_destination, referral_notes)
SELECT 'Bonneville Family Practice', 'referral_destination', '435-248-0333', 'https://bonnevillefp.com/', true,
       'Salt Lake and Tooele Medicaid. Provides therapy services. Also offers MAT (methadone).'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Bonneville Family Practice')));

INSERT INTO organizations (name, type, phone, email, is_referral_destination, referral_notes)
SELECT 'Blue Willow Psychiatry', 'referral_destination', '435-200-3430', 'Kristi@BlueWillowPsych.com', true,
       'Salt Lake and Tooele Medicaid. Provides therapy services. Med management & LAI.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Blue Willow Psychiatry')));

-- ============================================================================
-- Adult services (PDF pages 4-7)
-- ============================================================================

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, website, is_referral_destination, referral_notes)
SELECT 'Project Connection', 'referral_destination',
       '2655 S. Lake Erie Drive Suite B', 'West Valley', 'UT', '84210',
       '385-441-4900', 'https://projectconnection.co/community-programs', true,
       'CTI Program — Critical Time Intervention, Intensive Case Management for transition from inpatient MH back to community.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Project Connection')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, fax, email, is_referral_destination, referral_notes)
SELECT 'Reach Counseling', 'referral_destination',
       '873 W Baxter Drive', 'South Jordan', 'UT', '84095',
       '801-446-3515', '925-876-4282', 'admin@reachcounselingutah.com', true,
       'Adult IOP (3 hrs of groups 3x/week) and Youth IOP (ages 14-17). Services: individual & family therapy, perinatal yoga, attachment sessions, skills classes.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Reach Counseling')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Beacon House', 'referral_destination',
       '60 S Main St #6', 'Tooele', 'UT', '84074',
       '435-255-6150', 'admissions@beaconhouseut.com', true,
       'Adult IOP for MH and SUD. ASAM 1.0, 2.1, 2.5. 24-hour crisis, drug testing, supportive/sober living, peer services, case management, prescriber/med management.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Beacon House')));

-- Moving Forward Counseling → handled by UPDATE above (f864e1c2-…)

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, website, is_referral_destination, referral_notes)
SELECT 'Clinical Consultants', 'referral_destination',
       '754 North Main Street', 'Tooele', 'UT', '84074',
       '435-228-6523', 'https://www.clinicalconsultants.org', true,
       'Adult SUD IOP at Tooele office. Also: evaluations, ASAM 1.0 (adult & adolescent), ASAM 2.1, on-site MAT prescriber (Suboxone, Subutex, Naltrexone). Medicare provider.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Clinical Consultants')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Odyssey House', 'referral_destination',
       '344 East 100 South Suite 301', 'Salt Lake City', 'UT', '84111',
       '801-322-3222', true,
       'Men''s Residential 2411 S 1070 W, West Valley City UT 84119. Women''s Residential 645 S 1300 E, Salt Lake City UT 84102. Martindale Clinic 340 E 100 S, SLC 84111 (801-428-3500). Co-occurring MH/SUD. ASAM 1.0, 2.1, 2.5, 3.1, 3.3, 3.5. Youth ASAM 1.0, 3.1, 3.5. MAT: Suboxone, Subutex, Vivitrol, Methadone, Naltrexone, Buprenorphine. Admissions ext. 1. Medicare provider.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Odyssey House')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Turning Point - Mountain View Residential Treatment', 'referral_destination',
       '616 E 11000 S', 'Sandy', 'UT', '84070',
       '801-576-0745', 'steve.defrank@turningpointcenters.com', true,
       'Adult residential program for men and women with serious mental illness. Admissions 801-576-0745 option 1. Contact: Steve DeFrank 352-437-9641.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Turning Point - Mountain View Residential Treatment')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Valley Core', 'referral_destination',
       '443 S 600 East', 'Salt Lake City', 'UT', '84102',
       '801-963-4248', 'corereferrals@valleycares.com', true,
       'Co-occurring Reentry and Empowerment (CORE) program — residential treatment for adult male and female criminal offenders with co-occurring SUD and MH. Men''s Program 443 S 600 East, Women''s Program 1228 S 900 E SLC 84105. Access team 801-273-6430 / access@valleycares.com.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Valley Core')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Valley STEPS', 'referral_destination',
       '280 E 600 S', 'Salt Lake City', 'UT', '84111',
       '801-273-6430', 'access@valleycares.com', true,
       'Residential treatment for individuals needing support to obtain/maintain housing due to MH needs, financial issues, and access to resources.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Valley STEPS')));

-- ============================================================================
-- Adult Case Management providers (PDF pages 7-8)
-- ============================================================================

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Altium Health', 'referral_destination',
       '7181 Campus View Drive Suite# 1A', 'West Jordan', 'UT', '84084',
       '385-832-8239', true,
       'Adult case management. Admissions Coordinator: Amanda Herd.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Altium Health')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Amethyst Center for Healing', 'referral_destination',
       '718 S 600 E', 'Salt Lake City', 'UT', '84111',
       '801-467-2863', true,
       'Adult case management. Referral process: (1) referring provider emails the office to receive intake forms; (2) intake forms must be returned prior to member''s office visit.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Amethyst Center for Healing')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Bears Ears Child and Family Therapy', 'referral_destination',
       '22 West Vine Street', 'Tooele', 'UT', '84074',
       '435-882-4354', true,
       'Adult case management.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Bears Ears Child and Family Therapy')));

-- First Step House → handled by UPDATE above (c621d896-…)

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, fax, is_referral_destination, referral_notes)
SELECT 'GCS Foundation', 'referral_destination',
       '716 E 4500 S Suite #N160', 'Murray', 'UT', '84107',
       '801-281-1100', '801-281-1936', true,
       'Adult case management. Contact: Teri Hartman SSA Supervisor direct 385-388-0976, office x106. Mailing: PO Box 520009, Salt Lake City UT 84152-0009.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('GCS Foundation')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Hopeful Beginnings', 'referral_destination',
       '3280 W 3500 S', 'West Valley City', 'UT', '84119',
       '801-979-1351', 'dkoldewyn@hopefulbeginnings.net', true,
       'Adult case management AND Youth Day Treatment (ages 12-17). Daily short-term intensive day treatment, average LOS 2-3 months. CBT, wrap-around, med management, in-home wrap. Some courtesy transportation. Referrals: Dave Koldewyn LCSW, Program Manager, 801-557-5940.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Hopeful Beginnings')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Journey LLC', 'referral_destination',
       '1343 S Main Street Suite# B', 'South Salt Lake', 'UT', '84115',
       '801-232-7633', true,
       'Adult case management.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Journey LLC')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Lumos Enterprises', 'referral_destination',
       '14241 S Redwood Road Suite# 300', 'Riverton', 'UT', '84065',
       '385-342-0621', 'randi@lumosheals.com', true,
       'Adult case management AND Youth PHP/IOP. PHP: 1x/wk individual + family, 3hr skills/schoolwork, 4 DBT skills groups, 2 music/art groups. IOP: 9 hrs total therapy, 3 DBT, 3 music/rec, 1x/wk individual/family. Exclusions: aggression >1 setting, autism level 2, SUD primary, psychosis, binging/purging, IQ <80, no transportation. Referrals: Randi Bevins, Program/Admissions Director, 385-342-2808 / Randy Bevins 385-342-0621.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Lumos Enterprises')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Multicultural Counseling Center', 'referral_destination',
       '7625 S 3200 W', 'West Jordan', 'UT', '84084',
       '801-915-0359', true,
       'Adult case management.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Multicultural Counseling Center')));

-- Project Reality → handled by UPDATE above (5182f346-…)

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Silverado Counseling Services', 'referral_destination',
       'P.O. Box 824', 'Greendale', 'UT', '84020',
       '801-983-5540', true,
       'Adult case management.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Silverado Counseling Services')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'University of Utah Medical Center Department Psychiatry-Assessment & Referral Services', 'referral_destination',
       'P.O. Box 413076', 'Salt Lake City', 'UT', '84141',
       '801-587-2770', true,
       'Adult case management AND Adult/Youth SUD & MH assessments only (under "Assessment and Referral Services (ARS)"). Site: 525 East 100 South Suite 3100, SLC 84102. Medicare provider.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('University of Utah Medical Center Department Psychiatry-Assessment & Referral Services')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Utah Harm Reduction Coalition', 'referral_destination',
       '105 E Fort Union Blvd', 'Midvale', 'UT', '84047',
       '801-569-1995', true,
       'Adult case management AND adult SUD: ASAM 1.0, 2.1, 2.5, MAT. Case management line: 801-569-1995. SUD line: 801-604-5342. Address per case management line: 91 E Fort Union Blvd Midvale 84047.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Utah Harm Reduction Coalition')));

-- Wasatch Behavioral Health → handled by UPDATE above (6bf76ef1-…)

-- ============================================================================
-- Tooele SUD providers with ASAM / MAT (PDF pages 9-11)
-- ============================================================================

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Assessment and Referral Services (ARS)', 'referral_destination',
       '525 East 100 South Suite 3100', 'Salt Lake City', 'UT', '84102',
       '801-587-2770', true,
       'Adult and Youth — SUD & MH Assessments only. Medicare provider. (Operated by U of U Psychiatry.)'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Assessment and Referral Services (ARS)')));

INSERT INTO organizations (name, type, address, city, state, phone, is_referral_destination, referral_notes)
SELECT 'Aspen Ridge Counseling', 'referral_destination',
       'Various Locations', NULL, 'UT',
       '801-503-8937', true,
       'Adult only — ASAM 1.0. Individual therapy for SUD only.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Aspen Ridge Counseling')));

-- House of Hope → handled by UPDATE above (b099887f-…)

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Precipice Counseling', 'referral_destination',
       '352 N Main St', 'Tooele', 'UT', '84074',
       '435-200-2107', true,
       'Adolescent and Adult — ASAM 1.0. Assessments, individual therapy, drug testing.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Precipice Counseling')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'Tranquility Place', 'referral_destination',
       '160 E 800 S', 'Salt Lake City', 'UT', '84111',
       '801-924-9240', true,
       'Adult — ASAM 1.0, MAT (methadone clinic), individual counseling.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Tranquility Place')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, hours_of_operation, is_referral_destination, referral_notes)
SELECT 'True North Recovery and Wellness Center', 'referral_destination',
       '339 E 3900 South #155', 'Salt Lake City', 'UT', '84107',
       '801-263-1056', 'M-F 5:00-11:00am, Sat 6:00-8:00am', true,
       'Adult — ASAM 1.0. General outpatient, group sessions, SUD assessments, drug testing. MAT incl. Methadone, Buprenorphine, Vivitrol.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('True North Recovery and Wellness Center')));

-- ============================================================================
-- Youth Higher Levels of Care (PDF pages 12-14)
-- ============================================================================

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, email, is_referral_destination, referral_notes)
SELECT 'Aspire Academy', 'referral_destination',
       '371 S Vineyard Rd', 'Orem', 'UT', '84058',
       '801-367-6630', 'astansfield@wasatch.org', true,
       'High-needs adolescent female-only Level 6 residential with intermediate secure care. Ages 12-17. Intense weekly program: individual therapy 2x/wk, group 5x/wk, DBT, TF-CBT, life skills, healthy relationships, Voices/Seeking Safety. Program Manager: Amanda Stansfield, LCSW (Wasatch BH / CY-FAST / IP_USH). Referrals require clinician submission.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('Aspire Academy')));

-- VBH Day Treatment programs (AIM/DBT/KIDS/ACES) — see Valley Behavioral Health
-- row above. Notes: 3737 W 4100 S STE 100 West Valley City UT 84120; referrals
-- daytreatmentreferrals@valleycares.com / 801-565-9600. Granite School District
-- school component; med prescriber and courtesy transportation available.
-- (Not creating a separate org row — these are VBH programs.)

-- ============================================================================
-- Other youth services (PDF page 15)
-- ============================================================================

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, is_referral_destination, referral_notes)
SELECT 'VOA Homeless Youth', 'referral_destination',
       '888 S 400 W', 'Salt Lake City', 'UT', '84101',
       '801-364-0744', true,
       'Ages 15-22. Meals, emergency shelter, case management, support for homeless and at-risk teens. Division Director: Dani Nives x162. Program Manager YRC: Annie Brown x180.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('VOA Homeless Youth')));

INSERT INTO organizations (name, type, address, city, state, postal_code, phone, website, is_referral_destination, referral_notes)
SELECT 'JJS Youth Services', 'referral_destination',
       '3450 S 900 W', 'Salt Lake City', 'UT', '84119',
       '385-269-5105', 'https://jjys.utah.gov/services/youth-services', true,
       'High-fidelity wraparound (HFW) youth services. "No wrong door" approach to early intervention — evidence-based individualized youth/family plans, assessment, plan management. Statewide HFW referrals: 801-538-3995.'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE lower(trim(name)) = lower(trim('JJS Youth Services')));

COMMIT;

-- Verification:
-- SELECT name, city, is_referral_destination FROM organizations
-- WHERE is_referral_destination = true
-- ORDER BY created_at DESC LIMIT 50;

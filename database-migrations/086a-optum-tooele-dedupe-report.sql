-- Migration 086a: Dedupe report for incoming Optum Tooele organizations
--
-- READ-ONLY. Run this in the Supabase SQL editor before 086b to see which
-- incoming organization names already exist in `organizations`. Review the
-- output and decide whether each "fuzzy match" is a real duplicate (and so
-- should be UPDATEd rather than INSERTed) or just a name collision.
--
-- The incoming names below are taken verbatim from the Optum Tooele County
-- Provider Resource Guide (rev 3.26.2026). The match strategy:
--   - exact:   lower(trim(name)) equality
--   - fuzzy:   ILIKE substring match either direction, or shared significant token
--
-- Output columns:
--   incoming_name   — what's in the PDF
--   match_type      — 'exact', 'fuzzy', or 'none'
--   existing_id     — uuid of the matching organizations row (NULL if 'none')
--   existing_name   — name of the matching row
--   is_referral_destination — current flag on the existing row

WITH incoming(incoming_name) AS (
  VALUES
    -- Medication management / LAI (page 4)
    ('Valley Behavioral Health'),
    ('Volunteers of America Utah'),
    ('Cornerstone Counseling Center'),
    ('Lotus Center Inc'),
    ('Dynamic Psychiatry'),
    ('Bonneville Family Practice'),
    ('Blue Willow Psychiatry'),
    -- Adult services (pages 4-7)
    ('Project Connection'),
    ('Reach Counseling'),
    ('Beacon House'),
    ('Moving Forward Counseling'),
    ('Clinical Consultants'),
    ('Odyssey House'),
    ('Turning Point - Mountain View Residential Treatment'),
    ('Valley Core'),
    ('Valley STEPS'),
    -- Adult case management (pages 7-8)
    ('Altium Health'),
    ('Amethyst Center for Healing'),
    ('Bears Ears Child and Family Therapy'),
    ('First Step House'),
    ('GCS Foundation'),
    ('Hopeful Beginnings'),
    ('Journey LLC'),
    ('Lumos Enterprises'),
    ('Multicultural Counseling Center'),
    ('Project Reality'),
    ('Silverado Counseling Services'),
    ('University of Utah Medical Center Department Psychiatry-Assessment & Referral Services'),
    ('Utah Harm Reduction Coalition'),
    ('Wasatch Behavioral Health'),
    -- Tooele SUD (pages 9-11)
    ('Assessment and Referral Services (ARS)'),
    ('Aspen Ridge Counseling'),
    ('House of Hope'),
    ('Precipice Counseling'),
    ('Tranquility Place'),
    ('True North Recovery and Wellness Center'),
    -- Youth HLOC (pages 12-14)
    ('Aspire Academy'),
    -- Other youth (page 15)
    ('VOA Homeless Youth'),
    ('JJS Youth Services')
),
matches AS (
  SELECT
    i.incoming_name,
    o.id AS existing_id,
    o.name AS existing_name,
    o.is_referral_destination,
    CASE
      WHEN lower(trim(o.name)) = lower(trim(i.incoming_name)) THEN 'exact'
      WHEN o.name ILIKE '%' || i.incoming_name || '%'
        OR i.incoming_name ILIKE '%' || o.name || '%' THEN 'fuzzy'
      ELSE 'token'
    END AS match_type,
    -- Rank: prefer exact over fuzzy
    CASE
      WHEN lower(trim(o.name)) = lower(trim(i.incoming_name)) THEN 1
      WHEN o.name ILIKE '%' || i.incoming_name || '%' THEN 2
      WHEN i.incoming_name ILIKE '%' || o.name || '%' THEN 3
      ELSE 4
    END AS match_rank
  FROM incoming i
  LEFT JOIN organizations o
    ON lower(trim(o.name)) = lower(trim(i.incoming_name))
    OR o.name ILIKE '%' || i.incoming_name || '%'
    OR i.incoming_name ILIKE '%' || o.name || '%'
),
ranked AS (
  SELECT
    incoming_name,
    existing_id,
    existing_name,
    is_referral_destination,
    match_type,
    ROW_NUMBER() OVER (PARTITION BY incoming_name ORDER BY match_rank, existing_name) AS rn
  FROM matches
)
SELECT
  incoming_name,
  COALESCE(match_type, 'none')              AS match_type,
  existing_id,
  existing_name,
  is_referral_destination
FROM ranked
WHERE rn = 1 OR (existing_id IS NULL AND rn IS NULL)
ORDER BY
  CASE COALESCE(match_type, 'none')
    WHEN 'exact' THEN 1
    WHEN 'fuzzy' THEN 2
    WHEN 'token' THEN 3
    ELSE 4
  END,
  incoming_name;

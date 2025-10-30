-- Migration 059: Role-Based Provider Compensation
-- Purpose: Replace per-provider rules with role-based rules (ATTENDING vs RESIDENT)
-- Date: 2025-10-30
--
-- This migration refactors the compensation system to use role-based rules
-- instead of creating duplicate rules for each provider.
--
-- Compensation Structure:
--   Intake: $190
--   Short follow-up: $63
--   Longer follow-up (Extended): $126
--   Extended follow-up (therapy): $185 (service not yet identified)
--
-- Roles:
--   ATTENDING: Anthony Privratsky, Merrick Reynolds, Tatiana Kaehler, Travis Norseth
--   RESIDENT: Rufus Sweeney

-- ============================================================================
-- STEP 1: Rollback any existing per-provider rules from migration 058
-- ============================================================================

DELETE FROM public.provider_pay_rules
WHERE effective_from = '2025-01-01'
  AND notes LIKE '%ATTENDING%'
  OR notes LIKE '%RESIDENT%';

-- ============================================================================
-- STEP 2: Add role-based schema to provider_pay_rules
-- ============================================================================

-- Add provider_role column
ALTER TABLE public.provider_pay_rules
ADD COLUMN IF NOT EXISTS provider_role TEXT;

-- Make provider_id nullable (allow role-based OR provider-specific rules)
ALTER TABLE public.provider_pay_rules
ALTER COLUMN provider_id DROP NOT NULL;

-- Add constraint: must have EITHER provider_id OR provider_role
ALTER TABLE public.provider_pay_rules
DROP CONSTRAINT IF EXISTS check_provider_or_role;

ALTER TABLE public.provider_pay_rules
ADD CONSTRAINT check_provider_or_role
CHECK (
  (provider_id IS NOT NULL AND provider_role IS NULL) OR
  (provider_id IS NULL AND provider_role IS NOT NULL)
);

COMMENT ON COLUMN public.provider_pay_rules.provider_role IS
'Role-based rules apply to all providers with matching role (ATTENDING, RESIDENT, etc). Mutually exclusive with provider_id.';

-- ============================================================================
-- STEP 3: Update rule matching function to support role fallback
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_provider_pay_rule(
  p_provider_id uuid,
  p_service_id uuid,
  p_payer_id uuid,
  p_dos date
) RETURNS TABLE(
  rule_id uuid,
  percent numeric,
  flat_cents int,
  basis provider_pay_basis
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_provider_role TEXT;
BEGIN
  -- Get provider's role for fallback matching
  SELECT role INTO v_provider_role
  FROM public.providers
  WHERE id = p_provider_id;

  -- Find most specific rule with fallback logic:
  --   1. Provider-specific rules (highest priority)
  --   2. Role-based rules (fallback)
  --
  -- Within each tier, use specificity: service+payer > service > payer > general
  RETURN QUERY
  SELECT
    r.id,
    r.percent,
    r.flat_cents,
    r.basis
  FROM public.provider_pay_rules r
  WHERE
    -- Match either provider-specific OR role-based rules
    (r.provider_id = p_provider_id OR r.provider_role = v_provider_role)
    -- Service and payer filters
    AND (r.applies_service_id IS NULL OR r.applies_service_id = p_service_id)
    AND (r.applies_payer_id IS NULL OR r.applies_payer_id = p_payer_id)
    -- Date range
    AND p_dos >= r.effective_from
    AND (r.effective_to IS NULL OR p_dos <= r.effective_to)
  ORDER BY
    -- Tier 1: Provider-specific rules beat role-based rules
    CASE
      WHEN r.provider_id IS NOT NULL THEN 1  -- Provider-specific
      WHEN r.provider_role IS NOT NULL THEN 2  -- Role-based
    END,
    -- Tier 2: Within tier, use specificity (service+payer > service > payer > general)
    CASE
      WHEN r.applies_service_id IS NOT NULL AND r.applies_payer_id IS NOT NULL THEN 1
      WHEN r.applies_service_id IS NOT NULL THEN 2
      WHEN r.applies_payer_id IS NOT NULL THEN 3
      ELSE 4
    END,
    -- Tier 3: User-defined priority (lower = higher precedence)
    r.priority ASC,
    -- Tier 4: Most recent rule wins
    r.effective_from DESC
  LIMIT 1;
END; $$;

COMMENT ON FUNCTION public.fn_get_provider_pay_rule IS
'Find most specific provider pay rule with provider-specific > role-based fallback logic';

-- ============================================================================
-- STEP 4: Update provider roles
-- ============================================================================

-- Mark attending physicians
UPDATE public.providers
SET role = 'ATTENDING'
WHERE id IN (
  '504d53c6-54ef-40b0-81d4-80812c2c7bfd',  -- Anthony Privratsky
  'bc0fc904-7cc9-4d22-a094-6a0eb482128d',  -- Merrick Reynolds
  '19efc9c8-3950-45c4-be1d-f0e04615e0d1',  -- Tatiana Kaehler
  '35ab086b-2894-446d-9ab5-3d41613017ad'   -- Travis Norseth
);

-- Mark resident physicians
UPDATE public.providers
SET role = 'RESIDENT'
WHERE id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694';  -- Rufus Sweeney

-- ============================================================================
-- STEP 5: Insert role-based compensation rules
-- ============================================================================

-- Service IDs from current data:
-- Intake: f0a05d4c-188a-4f1b-9600-54d6c27a3f62
-- Follow-up (Short): 54808e0f-38a2-45ed-8c2a-683c0c15ca29, 4b6e81ed-e30e-4127-ba71-21aa9fac8cd1
-- Follow-up (Extended) [$126]: 02120131-25e3-4ccf-8180-98f76b489d97, a6cdf789-41f7-484d-a948-272547eb566e
-- Follow-up (therapy) [$185]: NOT YET IDENTIFIED - add when found

-- ----------------------------------------------------------------------------
-- ATTENDING PHYSICIAN RULES (apply to ALL attendings)
-- ----------------------------------------------------------------------------

INSERT INTO public.provider_pay_rules (
  id, provider_role, basis, flat_cents, applies_service_id, priority, effective_from, notes
) VALUES
  -- Intake: $190
  (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 19000, 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62', 50, '2025-01-01', 'Attending physicians: Intake flat rate'),

  -- Short Follow-up: $63 (both service instances)
  (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 6300, '54808e0f-38a2-45ed-8c2a-683c0c15ca29', 50, '2025-01-01', 'Attending physicians: Short follow-up flat rate'),
  (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 6300, '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1', 50, '2025-01-01', 'Attending physicians: Short follow-up flat rate'),

  -- Longer Follow-up (Extended): $126 (both service instances)
  (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 12600, '02120131-25e3-4ccf-8180-98f76b489d97', 50, '2025-01-01', 'Attending physicians: Longer follow-up (Extended) flat rate'),
  (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 12600, 'a6cdf789-41f7-484d-a948-272547eb566e', 50, '2025-01-01', 'Attending physicians: Longer follow-up (Extended) flat rate');

-- ----------------------------------------------------------------------------
-- RESIDENT PHYSICIAN RULES (apply to ALL residents)
-- Same rates for now, but separate rules for future differentiation
-- ----------------------------------------------------------------------------

INSERT INTO public.provider_pay_rules (
  id, provider_role, basis, flat_cents, applies_service_id, priority, effective_from, notes
) VALUES
  -- Intake: $190
  (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 19000, 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62', 50, '2025-01-01', 'Resident physicians: Intake flat rate'),

  -- Short Follow-up: $63 (both service instances)
  (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 6300, '54808e0f-38a2-45ed-8c2a-683c0c15ca29', 50, '2025-01-01', 'Resident physicians: Short follow-up flat rate'),
  (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 6300, '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1', 50, '2025-01-01', 'Resident physicians: Short follow-up flat rate'),

  -- Longer Follow-up (Extended): $126 (both service instances)
  (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 12600, '02120131-25e3-4ccf-8180-98f76b489d97', 50, '2025-01-01', 'Resident physicians: Longer follow-up (Extended) flat rate'),
  (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 12600, 'a6cdf789-41f7-484d-a948-272547eb566e', 50, '2025-01-01', 'Resident physicians: Longer follow-up (Extended) flat rate');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check role-based rules (should show ~10 rows total)
SELECT
  COALESCE(p.first_name || ' ' || p.last_name, '(Role: ' || pr.provider_role || ')') as applies_to,
  s.name as service,
  pr.flat_cents / 100.0 as rate_dollars,
  pr.notes,
  pr.effective_from
FROM provider_pay_rules pr
LEFT JOIN providers p ON p.id = pr.provider_id
LEFT JOIN services s ON s.id = pr.applies_service_id
WHERE pr.effective_from = '2025-01-01'
ORDER BY pr.provider_role, s.name;

-- Check provider roles (should show 4 ATTENDING, 1 RESIDENT)
SELECT
  first_name || ' ' || last_name as provider,
  role,
  title
FROM providers
WHERE is_active = true
ORDER BY role, last_name;

-- ============================================================================
-- TODO: Add "Extended follow-up (therapy)" service when identified
-- ============================================================================
-- When you identify the service for "Extended follow-up (therapy): $185", add rules like:
--
-- INSERT INTO public.provider_pay_rules (
--   id, provider_role, basis, flat_cents, applies_service_id, priority, effective_from, notes
-- ) VALUES
--   (gen_random_uuid(), 'ATTENDING', 'EXPECTED', 18500, '<therapy-service-id>', 50, '2025-01-01', 'Attending: Extended follow-up (therapy)'),
--   (gen_random_uuid(), 'RESIDENT', 'EXPECTED', 18500, '<therapy-service-id>', 50, '2025-01-01', 'Resident: Extended follow-up (therapy)');

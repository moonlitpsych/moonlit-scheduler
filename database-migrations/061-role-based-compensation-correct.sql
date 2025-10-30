-- Migration 061: Role-Based Provider Compensation (CORRECT VERSION)
-- Purpose: Use existing roles table for compensation rules
-- Date: 2025-10-30
--
-- Compensation Structure:
--   Intake: $190
--   Short follow-up: $63
--   Longer follow-up (Extended): $126
--   Extended follow-up (Intensive/therapy): $185

-- ============================================================================
-- STEP 1: Add role_id FK to provider_pay_rules (uses existing roles table)
-- ============================================================================

-- Add role_id column as FK to existing roles table
ALTER TABLE public.provider_pay_rules
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);

-- Make provider_id nullable (allow role-based rules)
ALTER TABLE public.provider_pay_rules
ALTER COLUMN provider_id DROP NOT NULL;

-- Add constraint: must have EITHER provider_id OR role_id
ALTER TABLE public.provider_pay_rules
DROP CONSTRAINT IF EXISTS check_provider_or_role;

ALTER TABLE public.provider_pay_rules
ADD CONSTRAINT check_provider_or_role
CHECK (
  (provider_id IS NOT NULL AND role_id IS NULL) OR
  (provider_id IS NULL AND role_id IS NOT NULL)
);

COMMENT ON COLUMN public.provider_pay_rules.role_id IS
'Role-based rules (FK to roles table). Mutually exclusive with provider_id. Provider-specific rules take precedence over role-based rules.';

-- ============================================================================
-- STEP 2: Update rule matching function to support role fallback
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
  v_provider_role_id UUID;
BEGIN
  -- Get provider's role_id for fallback matching
  SELECT role_id INTO v_provider_role_id
  FROM public.providers
  WHERE id = p_provider_id;

  -- Find most specific rule with fallback logic:
  --   Tier 1: Provider-specific rules (highest priority)
  --   Tier 2: Role-based rules (fallback)
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
    (r.provider_id = p_provider_id OR r.role_id = v_provider_role_id)
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
      WHEN r.role_id IS NOT NULL THEN 2      -- Role-based
    END,
    -- Tier 2: Within tier, use specificity
    CASE
      WHEN r.applies_service_id IS NOT NULL AND r.applies_payer_id IS NOT NULL THEN 1
      WHEN r.applies_service_id IS NOT NULL THEN 2
      WHEN r.applies_payer_id IS NOT NULL THEN 3
      ELSE 4
    END,
    -- Tier 3: User-defined priority
    r.priority ASC,
    -- Tier 4: Most recent rule wins
    r.effective_from DESC
  LIMIT 1;
END; $$;

COMMENT ON FUNCTION public.fn_get_provider_pay_rule IS
'Find most specific provider pay rule with provider-specific > role-based fallback. Uses existing roles table via role_id FK.';

-- ============================================================================
-- STEP 3: Ensure roles exist in roles table
-- ============================================================================

-- Insert ATTENDING role if not exists
INSERT INTO public.roles (id, name, description, permissions)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'ATTENDING',
  'Attending physician - supervising provider',
  '{"compensation_tier": "standard"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Insert RESIDENT role if not exists
INSERT INTO public.roles (id, name, description, permissions)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'RESIDENT',
  'Resident physician - supervised provider',
  '{"compensation_tier": "standard"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Assign providers to roles using role_id
-- ============================================================================

-- Assign ATTENDING role to attending physicians
UPDATE public.providers
SET role_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id IN (
  '504d53c6-54ef-40b0-81d4-80812c2c7bfd',  -- Anthony Privratsky
  'bc0fc904-7cc9-4d22-a094-6a0eb482128d',  -- Merrick Reynolds
  '19efc9c8-3950-45c4-be1d-f0e04615e0d1',  -- Tatiana Kaehler
  '35ab086b-2894-446d-9ab5-3d41613017ad'   -- Travis Norseth
);

-- Assign RESIDENT role to resident physicians
UPDATE public.providers
SET role_id = 'a0000000-0000-0000-0000-000000000002'
WHERE id = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694';  -- Rufus Sweeney

-- ============================================================================
-- STEP 5: Insert role-based compensation rules
-- ============================================================================

-- Service IDs:
-- Intake: f0a05d4c-188a-4f1b-9600-54d6c27a3f62
-- Follow-up (Short): 54808e0f-38a2-45ed-8c2a-683c0c15ca29, 4b6e81ed-e30e-4127-ba71-21aa9fac8cd1
-- Follow-up (Extended): 02120131-25e3-4ccf-8180-98f76b489d97, a6cdf789-41f7-484d-a948-272547eb566e
-- Follow-up (Intensive/therapy): c6395c3a-c4e7-4cb5-95d3-dbeb8ddffc8f

-- ----------------------------------------------------------------------------
-- ATTENDING PHYSICIAN RULES (role_id = a0000000-0000-0000-0000-000000000001)
-- ----------------------------------------------------------------------------

INSERT INTO public.provider_pay_rules (
  id, role_id, basis, flat_cents, applies_service_id, priority, effective_from, notes
) VALUES
  -- Intake: $190
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 19000, 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62', 50, '2025-01-01', 'ATTENDING: Intake'),

  -- Short Follow-up: $63 (both service instances)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 6300, '54808e0f-38a2-45ed-8c2a-683c0c15ca29', 50, '2025-01-01', 'ATTENDING: Short follow-up'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 6300, '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1', 50, '2025-01-01', 'ATTENDING: Short follow-up'),

  -- Longer Follow-up (Extended): $126 (both service instances)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 12600, '02120131-25e3-4ccf-8180-98f76b489d97', 50, '2025-01-01', 'ATTENDING: Longer follow-up (Extended)'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 12600, 'a6cdf789-41f7-484d-a948-272547eb566e', 50, '2025-01-01', 'ATTENDING: Longer follow-up (Extended)'),

  -- Extended Follow-up (Intensive/therapy): $185
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'EXPECTED', 18500, 'c6395c3a-c4e7-4cb5-95d3-dbeb8ddffc8f', 50, '2025-01-01', 'ATTENDING: Extended follow-up (Intensive/therapy)');

-- ----------------------------------------------------------------------------
-- RESIDENT PHYSICIAN RULES (role_id = a0000000-0000-0000-0000-000000000002)
-- Same rates for now, but separate for future differentiation
-- ----------------------------------------------------------------------------

INSERT INTO public.provider_pay_rules (
  id, role_id, basis, flat_cents, applies_service_id, priority, effective_from, notes
) VALUES
  -- Intake: $190
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 19000, 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62', 50, '2025-01-01', 'RESIDENT: Intake'),

  -- Short Follow-up: $63 (both service instances)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 6300, '54808e0f-38a2-45ed-8c2a-683c0c15ca29', 50, '2025-01-01', 'RESIDENT: Short follow-up'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 6300, '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1', 50, '2025-01-01', 'RESIDENT: Short follow-up'),

  -- Longer Follow-up (Extended): $126 (both service instances)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 12600, '02120131-25e3-4ccf-8180-98f76b489d97', 50, '2025-01-01', 'RESIDENT: Longer follow-up (Extended)'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 12600, 'a6cdf789-41f7-484d-a948-272547eb566e', 50, '2025-01-01', 'RESIDENT: Longer follow-up (Extended)'),

  -- Extended Follow-up (Intensive/therapy): $185
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', 'EXPECTED', 18500, 'c6395c3a-c4e7-4cb5-95d3-dbeb8ddffc8f', 50, '2025-01-01', 'RESIDENT: Extended follow-up (Intensive/therapy)');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check role-based rules (should show 12 rows: 2 roles × 6 services)
SELECT
  ro.name as role,
  s.name as service,
  pr.flat_cents / 100.0 as rate_dollars,
  pr.notes
FROM provider_pay_rules pr
JOIN roles ro ON ro.id = pr.role_id
JOIN services s ON s.id = pr.applies_service_id
WHERE pr.effective_from = '2025-01-01'
ORDER BY ro.name, s.name;

-- Check provider role assignments (should show 4 ATTENDING, 1 RESIDENT)
SELECT
  p.first_name || ' ' || p.last_name as provider,
  r.name as role
FROM providers p
LEFT JOIN roles r ON r.id = p.role_id
WHERE p.is_active = true
ORDER BY r.name, p.last_name;

SELECT '✅ Migration 061: Role-based compensation using existing roles table' AS status;

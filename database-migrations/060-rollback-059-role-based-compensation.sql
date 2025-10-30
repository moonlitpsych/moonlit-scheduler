-- Migration 060: Rollback Migration 059 (Role-based Compensation)
-- Purpose: Rollback the incorrect role-based compensation migration
-- Date: 2025-10-30

-- ============================================================================
-- STEP 1: Delete all rules created by migration 059
-- ============================================================================

DELETE FROM public.provider_pay_rules
WHERE effective_from = '2025-01-01'
  AND (notes LIKE '%Attending physicians%' OR notes LIKE '%Resident physicians%');

-- ============================================================================
-- STEP 2: Remove schema changes
-- ============================================================================

-- Drop the constraint
ALTER TABLE public.provider_pay_rules
DROP CONSTRAINT IF EXISTS check_provider_or_role;

-- Drop the provider_role column
ALTER TABLE public.provider_pay_rules
DROP COLUMN IF EXISTS provider_role;

-- Restore provider_id NOT NULL constraint
ALTER TABLE public.provider_pay_rules
ALTER COLUMN provider_id SET NOT NULL;

-- ============================================================================
-- STEP 3: Rollback provider role updates
-- ============================================================================

-- Clear the role field that was incorrectly set
UPDATE public.providers
SET role = NULL
WHERE role IN ('ATTENDING', 'RESIDENT');

-- ============================================================================
-- STEP 4: Restore original rule matching function
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
BEGIN
  -- Find most specific rule by priority (lower = higher precedence)
  RETURN QUERY
  SELECT
    r.id,
    r.percent,
    r.flat_cents,
    r.basis
  FROM public.provider_pay_rules r
  WHERE r.provider_id = p_provider_id
    AND (r.applies_service_id IS NULL OR r.applies_service_id = p_service_id)
    AND (r.applies_payer_id IS NULL OR r.applies_payer_id = p_payer_id)
    AND p_dos >= r.effective_from
    AND (r.effective_to IS NULL OR p_dos <= r.effective_to)
  ORDER BY
    -- Specificity: service+payer > service > payer > general
    CASE
      WHEN r.applies_service_id IS NOT NULL AND r.applies_payer_id IS NOT NULL THEN 1
      WHEN r.applies_service_id IS NOT NULL THEN 2
      WHEN r.applies_payer_id IS NOT NULL THEN 3
      ELSE 4
    END,
    r.priority ASC,
    r.effective_from DESC
  LIMIT 1;
END; $$;

COMMENT ON FUNCTION public.fn_get_provider_pay_rule IS 'Find most specific provider pay rule with priority matching';

SELECT 'Migration 060: Rollback complete' AS status;

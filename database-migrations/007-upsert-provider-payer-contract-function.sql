-- Migration: Create UPSERT function for provider_payer_networks
-- Date: October 8, 2025
-- Purpose: Allow contract creation form to save (create or update) without 409 conflicts

-- ============================================================================
-- Create function to upsert provider-payer contracts
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_provider_payer_contract(
  p_provider_id uuid,
  p_payer_id uuid,
  p_effective_date date,
  p_expiration_date date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  provider_id uuid,
  payer_id uuid,
  effective_date date,
  expiration_date date,
  status text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.provider_payer_networks AS ppn (
    provider_id,
    payer_id,
    effective_date,
    expiration_date,
    status,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_provider_id,
    p_payer_id,
    p_effective_date,
    p_expiration_date,
    COALESCE(p_status, 'in_network'),
    p_notes,
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_id, payer_id) DO UPDATE
  SET
    effective_date  = EXCLUDED.effective_date,
    expiration_date = EXCLUDED.expiration_date,
    status          = COALESCE(EXCLUDED.status, 'in_network'),
    notes           = CASE
                        WHEN EXCLUDED.notes IS NOT NULL AND EXCLUDED.notes != ''
                        THEN COALESCE(ppn.notes || E'\n', '') || EXCLUDED.notes
                        ELSE ppn.notes
                      END,
    updated_at      = NOW()
  RETURNING
    ppn.id,
    ppn.provider_id,
    ppn.payer_id,
    ppn.effective_date,
    ppn.expiration_date,
    ppn.status,
    ppn.notes,
    ppn.created_at,
    ppn.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- Grant execute permission to authenticated users (admin API will use service role)
GRANT EXECUTE ON FUNCTION upsert_provider_payer_contract TO authenticated;

-- ============================================================================
-- Test the function
-- ============================================================================

-- Test 1: Insert a new contract (should create)
-- Uncomment to test:
-- SELECT * FROM upsert_provider_payer_contract(
--   '00000000-0000-0000-0000-000000000001'::uuid,  -- provider_id (replace with real)
--   '00000000-0000-0000-0000-000000000002'::uuid,  -- payer_id (replace with real)
--   '2025-11-01'::date,                            -- effective_date
--   '2026-10-31'::date,                            -- expiration_date
--   NULL,                                           -- status (should default to 'in_network')
--   'Test contract creation'                        -- notes
-- );

-- Test 2: Update the same contract (should update, not throw 409)
-- SELECT * FROM upsert_provider_payer_contract(
--   '00000000-0000-0000-0000-000000000001'::uuid,
--   '00000000-0000-0000-0000-000000000002'::uuid,
--   '2025-12-01'::date,                            -- Changed effective_date
--   '2026-11-30'::date,                            -- Changed expiration_date
--   'pending',                                      -- Changed status
--   'Updated contract terms'                        -- notes (should append)
-- );

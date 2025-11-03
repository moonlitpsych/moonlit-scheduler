-- ============================================================================
-- Migration 035: Add UNIQUE Constraint to Idempotency Requests
-- Date: November 3, 2025
-- Purpose: Prevent race conditions in idempotency check-then-insert pattern
-- ============================================================================
--
-- CONTEXT:
-- Current implementation has a race condition where two concurrent requests
-- with the same idempotency key can both pass the SELECT check and both INSERT.
-- This migration adds a UNIQUE constraint to prevent duplicate keys.
--
-- PROBLEM IT SOLVES:
-- - Prevents duplicate bookings when users double-click rapidly
-- - Eliminates check-then-insert race condition
-- - Database enforces uniqueness at constraint level
--
-- ============================================================================

-- Step 1: Add UNIQUE constraint on key column
-- This will prevent duplicate keys from being inserted
ALTER TABLE idempotency_requests
ADD CONSTRAINT idempotency_requests_key_unique UNIQUE (key);

-- Step 2: Create index if not exists (improves lookup performance)
-- The UNIQUE constraint creates an index automatically, but we'll be explicit
CREATE INDEX IF NOT EXISTS idx_idempotency_requests_key
ON idempotency_requests(key);

-- Step 3: Verification
DO $$
DECLARE
    v_constraint_exists BOOLEAN;
BEGIN
    -- Check if constraint was added successfully
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'idempotency_requests'
        AND constraint_name = 'idempotency_requests_key_unique'
        AND constraint_type = 'UNIQUE'
    ) INTO v_constraint_exists;

    ASSERT v_constraint_exists = TRUE,
        'UNIQUE constraint was not added successfully!';

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 035 complete: UNIQUE constraint added to idempotency_requests';
    RAISE NOTICE '';
    RAISE NOTICE 'What this fixes:';
    RAISE NOTICE '  - Prevents duplicate bookings from rapid double-clicks';
    RAISE NOTICE '  - Eliminates race condition in concurrent requests';
    RAISE NOTICE '  - Database now enforces idempotency at constraint level';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Update book/route.ts to handle constraint violations:';
    RAISE NOTICE '  - Catch unique_violation (23505) errors on INSERT';
    RAISE NOTICE '  - Return cached response when constraint violation occurs';
    RAISE NOTICE '  - This means another request with same key already succeeded';
END $$;
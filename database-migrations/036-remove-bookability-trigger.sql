-- Migration: Remove bookability enforcement trigger
-- Date: November 11, 2025
-- Purpose: Remove redundant database trigger that blocked PracticeQ syncs
--
-- PROBLEM:
-- The enforce_bookable_provider_payer() trigger was blocking:
-- 1. PracticeQ syncs - Historical appointments from production EHR
-- 2. Admin corrections - Legitimate fixes to appointment data
-- 3. Edge cases - Expired contracts that were valid when appointment was created
--
-- EXAMPLE:
-- Michael Sweitzer's upcoming appointment (PQ ID: 68ee4695834e17b38b067b4b)
-- Failed with: "Provider not bookable with this payer on the selected date"
-- This is a real appointment scheduled by staff in PracticeQ
--
-- WHY REMOVE?
-- Bookability is already enforced in the patient booking flow:
-- 1. User selects insurance (payer)
-- 2. Availability API queries v_bookable_provider_payer
-- 3. Only shows providers bookable with that payer
-- 4. User picks from pre-filtered available slots
--
-- The database trigger was redundant and causing operational pain.
--
-- DECISION:
-- Remove trigger entirely. Bookability enforcement belongs in the booking flow,
-- not as a database constraint that blocks legitimate operations.
--
-- ============================================================================
-- Drop function and all dependent triggers using CASCADE
-- ============================================================================

DROP FUNCTION IF EXISTS enforce_bookable_provider_payer() CASCADE;

-- This automatically drops:
-- - trg_enforce_bookable_on_appointments (trigger)
-- - check_bookable_provider_payer (trigger)
-- - Any other dependent objects

-- ============================================================================
-- Verification
-- ============================================================================

-- After running this migration:
-- 1. PracticeQ syncs work for all appointments (no bookability checks)
-- 2. Admin can correct appointment data without validation errors
-- 3. Patient booking flow still enforces bookability via availability API

-- Test by re-syncing Michael Sweitzer - appointment should sync successfully

-- ============================================================================
-- Notes
-- ============================================================================

-- Bookability enforcement now happens ONLY in booking flow:
-- - /api/patient-booking/merged-availability (filters by v_bookable_provider_payer)
-- - /api/patient-booking/book (validates slot came from availability API)
--
-- Database no longer blocks appointment inserts based on bookability.
-- This is correct architecture: enforce rules at input, not storage layer.

-- 085: Drop orphan appointments.roi_contacts column
--
-- Context: this column was reserved in 2025 for a booking-flow ROI feature
-- that was never wired up. The UI (ROIView.tsx) and backend persistence
-- were both removed in commit deleting `src/components/booking/views/ROIView.tsx`.
-- The column was never written to in production.
--
-- NOT TO BE CONFUSED WITH: patient_organization_affiliations.roi_contacts,
-- which is a LIVE production column used by the partner dashboard
-- (api/org/affiliations, api/org/patients) to track which third-party
-- contacts a partner is authorized to share patient info with.
-- That column is NOT touched by this migration.
--
-- Safety: this migration is reversible (re-add the column) and there is
-- no data to preserve. Run when convenient.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'appointments'
      AND column_name = 'roi_contacts'
  ) THEN
    ALTER TABLE appointments DROP COLUMN roi_contacts;
    RAISE NOTICE 'Dropped appointments.roi_contacts';
  ELSE
    RAISE NOTICE 'appointments.roi_contacts already absent, nothing to do';
  END IF;
END $$;

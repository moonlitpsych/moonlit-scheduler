-- ============================================================================
-- Migration 014: Partner Dashboard V3.0 Schema
-- Created: 2025-10-16
-- Description: Schema updates for Partner Dashboard V3.0 MVP
-- ============================================================================

-- ============================================================================
-- 1. UPDATE partner_users TABLE (already exists)
-- ============================================================================
-- Add new columns for V3.0: invitation system, contact link, preferences
-- Keep existing columns: auth_user_id, full_name, is_active, wants_org_broadcasts

-- Add contact_id link to CRM contacts table
ALTER TABLE partner_users
  ADD COLUMN IF NOT EXISTS contact_id uuid NULL REFERENCES contacts(id) ON DELETE SET NULL;

-- Add invitation system columns
ALTER TABLE partner_users
  ADD COLUMN IF NOT EXISTS invitation_token text NULL,
  ADD COLUMN IF NOT EXISTS invitation_expires timestamptz NULL,
  ADD COLUMN IF NOT EXISTS invited_by uuid NULL REFERENCES partner_users(id) ON DELETE SET NULL;

-- Add activity tracking
ALTER TABLE partner_users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Add notification preferences (more granular than wants_org_broadcasts)
ALTER TABLE partner_users
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
    "email_new_assignments": true,
    "email_appointment_changes": true,
    "email_appointment_reminders": true,
    "email_weekly_summary": false
  }'::jsonb;

-- Add timezone
ALTER TABLE partner_users
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Denver';

-- Drop old role constraint and add new one with 'partner_referrer'
ALTER TABLE partner_users
  DROP CONSTRAINT IF EXISTS partner_users_role_check;

ALTER TABLE partner_users
  ADD CONSTRAINT partner_users_role_check CHECK (
    role IN ('partner_admin', 'partner_case_manager', 'partner_referrer')
  );

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_partner_users_contact
  ON partner_users(contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_users_invitation_token
  ON partner_users(invitation_token) WHERE invitation_token IS NOT NULL;

-- Add comments
COMMENT ON COLUMN partner_users.contact_id IS 'Link to contacts (CRM) table - can exist before user has auth account';
COMMENT ON COLUMN partner_users.role IS 'partner_admin: full org access, can invite; partner_case_manager: full patient access (Beth); partner_referrer: booking only, no dashboard (Eddie)';
COMMENT ON COLUMN partner_users.notification_preferences IS 'Granular notification settings - supplements wants_org_broadcasts';
COMMENT ON COLUMN partner_users.invitation_token IS 'Token for accepting invitation - allows invited users to set up account';

-- ============================================================================
-- 2. UPDATE patient_organization_affiliations TABLE
-- ============================================================================
-- Add columns for case manager assignment, ROI tracking, and affiliation type

-- Add primary_contact_user_id (which case manager is assigned)
ALTER TABLE patient_organization_affiliations
  ADD COLUMN IF NOT EXISTS primary_contact_user_id uuid NULL
    REFERENCES partner_users(id) ON DELETE SET NULL;

-- Add affiliation_type (case_management vs referral_source)
ALTER TABLE patient_organization_affiliations
  ADD COLUMN IF NOT EXISTS affiliation_type text DEFAULT 'case_management'
    CHECK (affiliation_type IN ('case_management', 'referral_source', 'treatment_program', 'other'));

-- Add ROI file storage
ALTER TABLE patient_organization_affiliations
  ADD COLUMN IF NOT EXISTS roi_file_url text NULL;

-- Add status column if not exists
ALTER TABLE patient_organization_affiliations
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'transferred'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_poa_primary_contact
  ON patient_organization_affiliations(primary_contact_user_id)
  WHERE primary_contact_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_poa_status_active
  ON patient_organization_affiliations(organization_id, status)
  WHERE status = 'active';

COMMENT ON COLUMN patient_organization_affiliations.primary_contact_user_id IS 'The partner_user (case manager) assigned to this patient';
COMMENT ON COLUMN patient_organization_affiliations.affiliation_type IS 'Type of relationship: case_management (Beth model), referral_source (Eddie model), etc.';
COMMENT ON COLUMN patient_organization_affiliations.roi_file_url IS 'Optional: Link to uploaded ROI PDF in Supabase Storage';

-- ============================================================================
-- 3. UPDATE patients TABLE
-- ============================================================================
-- Add referral tracking columns

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS referred_by_partner_user_id uuid NULL
    REFERENCES partner_users(id) ON DELETE SET NULL;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS referred_by_organization_id uuid NULL
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_referred_by_user
  ON patients(referred_by_partner_user_id)
  WHERE referred_by_partner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_referred_by_org
  ON patients(referred_by_organization_id)
  WHERE referred_by_organization_id IS NOT NULL;

COMMENT ON COLUMN patients.referred_by_partner_user_id IS 'Which partner user referred this patient (Eddie or Beth)';
COMMENT ON COLUMN patients.referred_by_organization_id IS 'Which organization referred this patient';

-- ============================================================================
-- 4. UPDATE organizations TABLE
-- ============================================================================
-- Add BAA (Business Associate Agreement) tracking

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS baa_accepted_at timestamptz NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS baa_accepted_by text NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS baa_version text NULL;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS partnership_agreement_accepted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_baa_status
  ON organizations(id, baa_accepted_at)
  WHERE baa_accepted_at IS NOT NULL;

COMMENT ON COLUMN organizations.baa_accepted_at IS 'When the Business Associate Agreement was accepted';
COMMENT ON COLUMN organizations.baa_accepted_by IS 'Email of the person who accepted the BAA';
COMMENT ON COLUMN organizations.baa_version IS 'Version of BAA accepted (e.g., "2025-v1")';

-- ============================================================================
-- 5. UPDATE partner_user_patient_assignments TABLE (already exists)
-- ============================================================================
-- Track which case managers are assigned to which patients
-- Existing table only has: id, partner_user_id, patient_id
-- Need to add: organization_id, assignment_type, dates, status, etc.

-- Add organization_id (critical - needed for foreign key and indexes)
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL;

-- Add foreign key constraint for organization_id (only if column was just added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'partner_user_patient_assignments_organization_id_fkey'
      AND table_name = 'partner_user_patient_assignments'
  ) THEN
    ALTER TABLE partner_user_patient_assignments
      ADD CONSTRAINT partner_user_patient_assignments_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add assignment_type column
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'primary';

-- Add constraint for assignment_type (drop first if exists)
ALTER TABLE partner_user_patient_assignments
  DROP CONSTRAINT IF EXISTS partner_user_patient_assignments_assignment_type_check;

ALTER TABLE partner_user_patient_assignments
  ADD CONSTRAINT partner_user_patient_assignments_assignment_type_check
    CHECK (assignment_type IN ('primary', 'secondary', 'temporary'));

-- Add date columns
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS assigned_date timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unassigned_date timestamptz NULL;

-- Add notification settings
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS receives_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_types text[] DEFAULT ARRAY['appointment_changes', 'new_appointments', 'forms_due'];

-- Add status column
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add constraint for status (drop first if exists)
ALTER TABLE partner_user_patient_assignments
  DROP CONSTRAINT IF EXISTS partner_user_patient_assignments_status_check;

ALTER TABLE partner_user_patient_assignments
  ADD CONSTRAINT partner_user_patient_assignments_status_check
    CHECK (status IN ('active', 'inactive'));

-- Add notes column
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS notes text NULL;

-- Add timestamps
ALTER TABLE partner_user_patient_assignments
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Indexes (only create after status column exists)
CREATE INDEX IF NOT EXISTS idx_assignments_partner_user
  ON partner_user_patient_assignments(partner_user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_assignments_patient
  ON partner_user_patient_assignments(patient_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_assignments_org
  ON partner_user_patient_assignments(organization_id)
  WHERE status = 'active';

-- Partial unique constraint: Only one active primary assignment per patient per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_primary_assignment
  ON partner_user_patient_assignments(patient_id, organization_id)
  WHERE status = 'active' AND assignment_type = 'primary';

-- Trigger for updated_at (drop first if exists)
DROP TRIGGER IF EXISTS set_updated_at_assignments ON partner_user_patient_assignments;

CREATE TRIGGER set_updated_at_assignments
  BEFORE UPDATE ON partner_user_patient_assignments
  FOR EACH ROW
  EXECUTE FUNCTION tg_set_updated_at();

COMMENT ON TABLE partner_user_patient_assignments IS 'Tracks which case managers are assigned to which patients. Supports primary/secondary/temporary assignments (V3.0 uses primary only).';

-- ============================================================================
-- 6. CREATE patient_activity_log TABLE
-- ============================================================================
-- Activity feed for patients (replaces message dedupe)

CREATE TABLE IF NOT EXISTS public.patient_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Links
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
  appointment_id uuid NULL REFERENCES appointments(id) ON DELETE SET NULL,

  -- Activity Details
  activity_type text NOT NULL
    CHECK (activity_type IN (
      'patient_created',
      'appointment_booked',
      'appointment_confirmed',
      'appointment_rescheduled',
      'appointment_cancelled',
      'roi_granted',
      'roi_expired',
      'form_sent',
      'form_completed',
      'reminder_sent',
      'case_manager_assigned',
      'case_manager_transferred',
      'note_added'
    )),

  -- Content
  title text NOT NULL,
  description text NULL,
  metadata jsonb NULL,

  -- Actor (who did this action)
  actor_type text NULL CHECK (actor_type IN ('system', 'patient', 'provider', 'partner_user', 'admin')),
  actor_id uuid NULL,
  actor_name text NULL,

  -- Visibility
  visible_to_partner boolean DEFAULT true,
  visible_to_patient boolean DEFAULT false,

  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT patient_activity_log_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_patient_date
  ON patient_activity_log(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_org_date
  ON patient_activity_log(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_appointment
  ON patient_activity_log(appointment_id)
  WHERE appointment_id IS NOT NULL;

COMMENT ON TABLE patient_activity_log IS 'Activity feed for patients. Shows timeline of events for case managers.';

-- ============================================================================
-- 7. CREATE VIEWS FOR PARTNER DASHBOARD
-- ============================================================================

-- View: Active partner users with organization details
CREATE OR REPLACE VIEW v_active_partner_users AS
SELECT
  pu.id,
  pu.contact_id,
  pu.organization_id,
  pu.auth_user_id,
  pu.full_name,
  pu.email,
  pu.phone,
  pu.role,
  pu.is_active,
  pu.last_login_at,
  pu.notification_preferences,
  pu.wants_org_broadcasts,
  pu.timezone,
  pu.created_at,

  -- Organization details
  o.name as organization_name,
  o.type as organization_type,
  o.status as organization_status,

  -- Counts
  (SELECT COUNT(*)
   FROM partner_user_patient_assignments
   WHERE partner_user_id = pu.id AND status = 'active') as active_patient_count

FROM partner_users pu
JOIN organizations o ON o.id = pu.organization_id
WHERE pu.is_active = true;

COMMENT ON VIEW v_active_partner_users IS 'Active partner users with organization details and patient counts';

-- View: Partner user patients (for roster page)
CREATE OR REPLACE VIEW v_partner_user_patients AS
SELECT
  pupa.id as assignment_id,
  pupa.partner_user_id,
  pupa.patient_id,
  pupa.organization_id,
  pupa.assignment_type,
  pupa.assigned_date,
  pupa.receives_notifications,

  -- Patient details
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  p.email as patient_email,
  p.phone as patient_phone,
  p.date_of_birth,
  p.status as patient_status,

  -- Affiliation details
  poa.consent_on_file,
  poa.consent_expires_on,
  poa.roi_file_url,
  poa.start_date as affiliation_start_date,
  poa.end_date as affiliation_end_date,
  poa.notes as affiliation_notes,

  -- Next appointment
  (SELECT MIN(a.start_time)
   FROM appointments a
   WHERE a.patient_id = p.id
     AND a.status IN ('scheduled', 'confirmed')
     AND a.start_time > now()
  ) as next_appointment_date,

  -- Last appointment
  (SELECT MAX(a.start_time)
   FROM appointments a
   WHERE a.patient_id = p.id
     AND a.status = 'completed'
  ) as last_appointment_date

FROM partner_user_patient_assignments pupa
JOIN patients p ON p.id = pupa.patient_id
LEFT JOIN patient_organization_affiliations poa
  ON poa.patient_id = p.id
  AND poa.organization_id = pupa.organization_id
  AND poa.status = 'active'
WHERE pupa.status = 'active';

COMMENT ON VIEW v_partner_user_patients IS 'Partner user assigned patients with affiliation and appointment details';

-- ============================================================================
-- 8. SAMPLE DATA FOR FSH (First Step House)
-- ============================================================================
-- Link Beth Whipey contact to partner_users (if she doesn't already have an account)

DO $$
DECLARE
  v_beth_contact_id uuid := '442a8086-642e-47a1-8ddd-f389adb0f0f7';
  v_fsh_org_id uuid := 'c621d896-de55-4ea7-84c2-a01502249e82';
  v_beth_email text;
  v_beth_user_id uuid;
BEGIN
  -- Get Beth's email from contacts
  SELECT email INTO v_beth_email
  FROM contacts
  WHERE id = v_beth_contact_id;

  IF v_beth_email IS NULL THEN
    RAISE NOTICE 'Beth Whipey contact not found or has no email';
    RETURN;
  END IF;

  -- Check if Beth already has a partner_user account
  SELECT id INTO v_beth_user_id
  FROM partner_users
  WHERE lower(email) = lower(v_beth_email)
    AND organization_id = v_fsh_org_id;

  IF v_beth_user_id IS NULL THEN
    -- Check if there's a partner_user without contact_id that matches
    SELECT id INTO v_beth_user_id
    FROM partner_users
    WHERE organization_id = v_fsh_org_id
      AND contact_id IS NULL
      AND lower(email) = lower(v_beth_email);

    IF v_beth_user_id IS NOT NULL THEN
      -- Update existing partner_user to link contact
      UPDATE partner_users
      SET contact_id = v_beth_contact_id
      WHERE id = v_beth_user_id;

      RAISE NOTICE 'Linked existing partner_user % to contact %', v_beth_user_id, v_beth_contact_id;
    ELSE
      RAISE NOTICE 'No partner_user found for Beth Whipey - will need to be created via invitation flow';
    END IF;
  ELSE
    -- Update contact_id if not already set
    UPDATE partner_users
    SET contact_id = v_beth_contact_id
    WHERE id = v_beth_user_id
      AND contact_id IS NULL;

    RAISE NOTICE 'Beth Whipey already has partner_user account: %', v_beth_user_id;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration 014: Partner Dashboard V3.0 Schema - COMPLETE' as status;

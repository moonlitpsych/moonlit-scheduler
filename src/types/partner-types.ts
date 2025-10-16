// Partner Dashboard TypeScript Types
// Core types for the partner management system

export interface Organization {
  id: string
  name: string
  slug: string
  type: 'healthcare_partner' | 'treatment_center' | 'rehabilitation' | 'mental_health' | 'substance_abuse' | 'other'
  status: 'active' | 'inactive' | 'suspended'

  // Contact Information
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_contact_name?: string

  // Address
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  zip_code?: string

  // Business Details
  tax_id?: string
  license_number?: string
  accreditation_details?: string

  // System Configuration
  allowed_domains?: string[]
  settings?: Record<string, any>

  // Legal/Compliance (V3.0)
  baa_accepted_at?: string
  baa_accepted_by?: string
  baa_version?: string
  partnership_agreement_accepted_at?: string

  created_at: string
  updated_at: string
}

export interface Partner {
  id: string
  organization_id?: string
  organization?: Organization
  
  // Basic Information
  name: string
  contact_email?: string
  contact_phone?: string
  contact_person?: string
  title?: string
  
  // CRM Tracking
  stage: 'lead' | 'qualified' | 'contract_sent' | 'live' | 'dormant'
  status: 'prospect' | 'active' | 'paused' | 'terminated'
  source?: string
  
  // Relationship Details
  specialties?: string[]
  insurance_types?: string[]
  monthly_referral_capacity?: number
  preferred_providers?: string[]
  
  // Business Details
  notes?: string
  website?: string
  linkedin_url?: string
  
  // Lifecycle Tracking
  first_contact_date?: string
  last_contact_date?: string
  contract_signed_date?: string
  go_live_date?: string
  
  // System Fields
  created_by?: string
  assigned_to?: string
  
  created_at: string
  updated_at: string
}

export interface PartnerUser {
  id: string
  contact_id?: string // Link to contacts (CRM) table
  organization_id: string
  organization?: Organization
  auth_user_id: string // Required in existing schema

  // Personal Information (matches existing schema)
  full_name?: string // Existing field
  email?: string
  phone?: string

  // Role and Permissions
  role: 'partner_admin' | 'partner_case_manager' | 'partner_referrer'
  permissions?: Record<string, any>

  // Account Status (matches existing schema)
  is_active: boolean // Existing field
  wants_org_broadcasts?: boolean // Existing field
  email_verified?: boolean
  last_login_at?: string

  // Security (V3.0 additions)
  invitation_token?: string
  invitation_expires?: string
  invited_by?: string

  // Preferences (V3.0 additions)
  notification_preferences?: {
    email_new_assignments?: boolean
    email_appointment_changes?: boolean
    email_appointment_reminders?: boolean
    email_weekly_summary?: boolean
  }
  timezone?: string

  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  
  // Personal Information
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  
  // Demographics
  gender?: string
  preferred_language?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  
  // Insurance Information
  primary_insurance_payer_id?: string
  primary_insurance_payer?: {
    id: string
    name: string
  }
  member_id?: string
  group_number?: string
  insurance_effective_date?: string
  
  // Medical Information
  primary_diagnosis?: string
  medical_conditions?: string[]
  medications?: string[]
  allergies?: string[]
  
  // System Fields
  status: 'active' | 'inactive' | 'discharged'
  internal_id?: string
  external_ids?: Record<string, string>
  
  // Privacy and Consent
  hipaa_consent_date?: string
  roi_contacts?: any[]
  consent_to_telehealth?: boolean
  
  // Data Source Tracking
  source?: 'direct_booking' | 'partner_referral' | 'internal_transfer' | 'waitlist' | 'other'
  referred_by_organization_id?: string
  referred_by_partner_user_id?: string

  created_at: string
  updated_at: string
}

export interface PatientOrganizationAffiliation {
  id: string
  patient_id: string
  organization_id: string

  // Relationship Details
  affiliation_type: 'case_management' | 'referral_source' | 'treatment_program' | 'other'
  start_date: string
  end_date?: string

  // ROI and Consent (simplified from actual schema)
  consent_on_file: boolean
  consent_expires_on?: string
  roi_file_url?: string // Link to uploaded PDF in Supabase Storage

  // Assignment and Notes
  primary_contact_user_id?: string // Which partner user is primary contact
  notes?: string
  status: 'active' | 'inactive' | 'transferred'

  created_at: string
  updated_at: string

  // Populated by joins
  patient?: Patient
  organization?: Organization
  primary_contact_user?: PartnerUser
}

export interface PartnerUserPatientAssignment {
  id: string
  partner_user_id: string
  patient_id: string
  organization_id: string
  
  // Assignment Details
  assignment_type: 'primary' | 'secondary' | 'temporary'
  assigned_date: string
  unassigned_date?: string
  
  // Notifications
  receives_notifications: boolean
  notification_types?: string[] // appointment_changes, cancellations, new_appointments, etc.
  
  notes?: string
  status: 'active' | 'inactive'
  
  created_at: string
  updated_at: string
  
  // Populated by joins
  partner_user?: PartnerUser
  patient?: Patient
  organization?: Organization
}

export interface AppointmentChangeRequest {
  id: string
  appointment_id: string
  requested_by_user_id: string
  
  // Change Details
  change_type: 'reschedule' | 'cancel' | 'modify_details'
  original_start_time?: string
  requested_start_time?: string
  original_provider_id?: string
  requested_provider_id?: string
  
  // Request Info
  reason: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  patient_preference?: string
  
  // Processing
  status: 'pending' | 'approved' | 'denied' | 'completed' | 'cancelled'
  processed_by?: string
  processed_at?: string
  processing_notes?: string
  
  // External System Integration
  external_system_status?: Record<string, any> // Status from Athena/IntakeQ
  external_confirmation_id?: string
  
  created_at: string
  updated_at: string
  
  // Populated by joins
  appointment?: any // Will use existing appointment type
  requested_by_user?: PartnerUser
}

// API Request/Response Types
export interface CreatePartnerRequest {
  name: string
  organization_id?: string
  contact_email?: string
  contact_phone?: string
  contact_person?: string
  title?: string
  stage?: Partner['stage']
  status?: Partner['status']
  source?: string
  specialties?: string[]
  insurance_types?: string[]
  monthly_referral_capacity?: number
  notes?: string
  website?: string
  linkedin_url?: string
  first_contact_date?: string
}

export interface CreateOrganizationRequest {
  name: string
  slug: string
  type?: Organization['type']
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_contact_name?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  zip_code?: string
  allowed_domains?: string[]
}

export interface CreatePartnerUserRequest {
  organization_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role?: PartnerUser['role']
  timezone?: string
}

export interface InvitePartnerUserRequest {
  organization_id: string
  email: string
  role: PartnerUser['role']
  first_name?: string
  last_name?: string
  message?: string
}

export interface CreateAffiliationRequest {
  patient_id: string
  organization_id: string
  affiliation_type: PatientOrganizationAffiliation['affiliation_type']
  start_date: string
  roi_consent_status: PatientOrganizationAffiliation['roi_consent_status']
  roi_scope?: string[]
  primary_contact_user_id?: string
  notes?: string
}

export interface PartnerDashboardFilters {
  date_range?: {
    start_date: string
    end_date: string
  }
  provider_ids?: string[]
  appointment_status?: string[]
  search?: string
  patient_status?: Patient['status'][]
  assigned_to_me?: boolean
}

export interface PartnerDashboardData {
  upcoming_appointments: any[] // Will use existing appointment type with patient info
  my_assigned_patients: Patient[]
  recent_changes: AppointmentChangeRequest[]
  organization_stats: {
    total_patients: number
    active_patients: number
    appointments_this_week: number
    pending_changes: number
  }
}

export interface PatientActivityLog {
  id: string
  patient_id: string
  organization_id?: string
  appointment_id?: string

  // Activity Details
  activity_type:
    | 'patient_created'
    | 'appointment_booked'
    | 'appointment_confirmed'
    | 'appointment_rescheduled'
    | 'appointment_cancelled'
    | 'roi_granted'
    | 'roi_expired'
    | 'form_sent'
    | 'form_completed'
    | 'reminder_sent'
    | 'case_manager_assigned'
    | 'case_manager_transferred'
    | 'note_added'

  // Content
  title: string
  description?: string
  metadata?: Record<string, any>

  // Actor (who did this action)
  actor_type?: 'system' | 'patient' | 'provider' | 'partner_user' | 'admin'
  actor_id?: string
  actor_name?: string

  // Visibility
  visible_to_partner: boolean
  visible_to_patient: boolean

  // Timestamp
  created_at: string
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

// Utility types
export type CreatePartnerResponse = ApiResponse<Partner>
export type GetPartnersResponse = ApiResponse<Partner[]>
export type CreateOrganizationResponse = ApiResponse<Organization>
export type GetOrganizationsResponse = ApiResponse<Organization[]>
export type CreatePartnerUserResponse = ApiResponse<PartnerUser>
export type GetPartnerUsersResponse = ApiResponse<PartnerUser[]>
export type GetPartnerDashboardResponse = ApiResponse<PartnerDashboardData>
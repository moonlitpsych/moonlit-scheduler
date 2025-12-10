/**
 * Unified Patient Roster Types
 *
 * These types define the normalized data structure used by the unified
 * PatientRoster component across all three user roles (partner, provider, admin).
 */

export type UserRole = 'partner' | 'provider' | 'admin'

export type EngagementStatus = 'active' | 'inactive' | 'discharged' | 'transferred' | 'deceased' | 'unresponsive'

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type ConsentStatus = 'active' | 'expired' | 'missing'

/**
 * Provider information
 */
export interface ProviderInfo {
  id: string
  first_name: string
  last_name: string
}

/**
 * Payer/Insurance information
 */
export interface PayerInfo {
  id: string
  name: string
  type?: string
  state?: string
}

/**
 * Organization affiliation details
 */
export interface OrganizationAffiliation {
  org_id: string
  org_name: string
  affiliation_type: string
}

/**
 * Location information for appointments
 */
export interface LocationInfo {
  locationId?: string
  locationName?: string
  locationType?: 'telehealth' | 'office' | 'home' | string
  placeOfService?: string  // CMS Place of Service codes: '02' = telehealth (not home), '10' = telehealth (home), '11' = office
  meetingUrl?: string
}

/**
 * Appointment details
 */
export interface AppointmentDetails {
  id: string
  patient_id: string
  start_time: string
  end_time?: string
  status: AppointmentStatus
  meeting_url?: string | null
  location_info?: LocationInfo | null
  practiceq_generated_google_meet?: string | null
  providers?: ProviderInfo
}

/**
 * ROI (Release of Information) details - Partner only
 */
export interface ROIDetails {
  affiliation_id: string
  consent_on_file: boolean
  consent_expires_on?: string | null
  consent_status: ConsentStatus
  roi_file_url?: string | null
  last_practiceq_sync_at?: string | null
}

/**
 * Assignment details - Partner only
 */
export interface AssignmentDetails {
  partner_user_id: string
  partner_user_name: string
}

/**
 * Follow-up information extracted from clinical notes
 */
export interface FollowUpDetails {
  text: string | null           // Exact phrasing from physician
  noteDate: string | null       // Date of the note it was extracted from
}

/**
 * Normalized patient roster item
 * This structure works for all three roles (partner, provider, admin)
 */
export interface PatientRosterItem {
  // Core patient info
  id: string  // Normalized from patient_id
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string

  // Status
  engagement_status: EngagementStatus

  // Provider assignment
  primary_provider_id?: string | null
  primary_provider?: ProviderInfo | null

  // Insurance/Payer
  primary_payer_id?: string | null
  primary_payer?: PayerInfo | null

  // Appointments
  next_appointment?: AppointmentDetails | null
  previous_appointment?: AppointmentDetails | null
  upcoming_appointment_count?: number
  has_future_appointment: boolean

  // Organizations
  shared_with_org_ids?: string[]
  affiliation_details?: OrganizationAffiliation[]

  // Case management
  primary_case_manager_id?: string | null
  case_manager_name?: string | null

  // Partner-specific fields
  roi?: ROIDetails | null
  is_assigned_to_me?: boolean
  current_assignment?: AssignmentDetails | null

  // Sync metadata
  last_intakeq_sync?: string | null
  last_practiceq_sync_at?: string | null

  // Follow-up from most recent locked clinical note
  next_follow_up?: FollowUpDetails | null
}

/**
 * Roster filters configuration
 */
export interface RosterFilters {
  // Search
  searchTerm?: string

  // Engagement status
  engagementStatus?: EngagementStatus | 'all'

  // Appointments
  appointmentFilter?: 'all' | 'has_future' | 'no_future'

  // Meeting links (for upcoming appointments)
  meetingLinkFilter?: 'all' | 'has_link' | 'no_link'

  // Organization (provider/admin)
  organizationId?: string | 'all'

  // Provider (admin only)
  providerId?: string | 'all'

  // Payer (provider/admin)
  payerId?: string | 'all'

  // Case manager (provider only)
  caseManagerId?: string | 'all'

  // Partner-specific filters
  filterType?: 'all' | 'assigned_to_me' | 'roi_missing' | 'active_only' | 'no_future_appt'

  // Test patients (admin only)
  showTestPatients?: boolean

  // Sorting
  sortColumn?: SortColumn | null
  sortDirection?: 'asc' | 'desc' | null

  // Pagination
  page?: number
  limit?: number
}

export type SortColumn =
  | 'name'
  | 'status'
  | 'previous'
  | 'next'
  | 'followUp'
  | 'provider'
  | 'payer'
  | 'organization'
  | 'caseManager'
  | 'contact'

/**
 * Roster statistics for stats cards
 */
export interface RosterStats {
  total: number
  active: number
  no_future_appointment: number

  // Partner-specific
  assigned_to_me?: number

  // Provider-specific
  with_case_management?: number

  // Admin-specific
  with_organizations?: number
  test_patients?: number
}

/**
 * API response structure
 */
export interface PatientRosterResponse {
  patients: PatientRosterItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
  stats: RosterStats
  filters_applied: Partial<RosterFilters>
}

/**
 * Props for PatientRoster component
 */
export interface PatientRosterProps {
  // User context
  userType: UserRole
  userId?: string  // partner_user_id or provider_id

  // Partner-only features
  enablePatientLinks?: boolean  // Make patient names clickable
  enableROIActions?: boolean    // Show ROI upload, consent status
  enableTransferAction?: boolean
  enableNotificationAction?: boolean
  enableMedicationReport?: boolean
  showAssignedFilter?: boolean  // Show "Assigned to Me" filter option

  // Provider/Admin features
  showCaseManagerColumn?: boolean
  showOrganizationColumn?: boolean

  // Admin-only features
  enableProviderFilter?: boolean
  enableTestPatientToggle?: boolean
  enableDiscoverPatients?: boolean
  enableBulkSelect?: boolean  // Enable multi-select checkboxes for bulk operations

  // Cross-role features
  enableAssignCaseManager?: boolean  // Show Assign/Transfer case manager actions

  // Customization
  title?: string
  defaultPageSize?: number
  apiEndpoint?: string  // Override default API endpoint

  // Initial filter state (e.g., from URL query params)
  initialFilters?: Partial<RosterFilters>
}

/**
 * CSV export configuration
 */
export interface CSVExportConfig {
  filename: string
  columns: {
    key: keyof PatientRosterItem | string
    label: string
    format?: (value: any) => string
  }[]
}

/**
 * Referral Network Types
 * Types for the referral resource generator system
 */

// ============================================
// CARE TYPES
// ============================================

export interface ReferralCareType {
  id: string
  name: string
  display_name: string
  description?: string | null
  display_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ============================================
// SPECIALTY TAGS
// ============================================

export type SpecialtyTagCategory = 'clinical' | 'population' | 'administrative'

export interface ReferralSpecialtyTag {
  id: string
  name: string
  display_name: string
  description?: string | null
  tag_category: SpecialtyTagCategory
  display_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// ============================================
// ORGANIZATION PAYER RELATIONSHIPS
// ============================================

export interface OrganizationAcceptedPayer {
  id: string
  organization_id: string
  payer_id: string
  verification_date?: string | null
  verified_by?: string | null
  notes?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  // Joined data
  payer?: {
    id: string
    name: string
  }
}

// ============================================
// ORGANIZATION CARE TYPE RELATIONSHIPS
// ============================================

export interface OrganizationCareType {
  id: string
  organization_id: string
  care_type_id: string
  notes?: string | null
  is_active: boolean
  created_at?: string
  // Joined data
  care_type?: ReferralCareType
}

// ============================================
// ORGANIZATION SPECIALTY RELATIONSHIPS
// ============================================

export interface OrganizationSpecialty {
  id: string
  organization_id: string
  specialty_tag_id: string
  notes?: string | null
  is_active: boolean
  created_at?: string
  // Joined data
  specialty_tag?: ReferralSpecialtyTag
}

// ============================================
// REFERRAL ORGANIZATION (EXTENDED)
// ============================================

export interface ReferralOrganization {
  id: string
  name: string
  type?: string | null
  status: string

  // Contact info (matches organizations table)
  phone?: string | null
  email?: string | null

  // Address (matches organizations table)
  address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null

  // Referral-specific fields
  is_referral_destination: boolean
  referral_notes?: string | null
  referral_internal_notes?: string | null
  hours_of_operation?: string | null
  website?: string | null
  fax?: string | null
  service_area?: string | null  // For multi-location orgs (e.g., "Bountiful, Layton, Syracuse")

  // Timestamps
  created_at?: string
  updated_at?: string

  // Joined data for referral queries
  accepted_payers?: OrganizationAcceptedPayer[]
  care_types?: OrganizationCareType[]
  specialties?: OrganizationSpecialty[]
}

// ============================================
// SEARCH CRITERIA & RESULTS
// ============================================

export interface ReferralSearchCriteria {
  payer_id: string
  care_type_ids: string[]
  specialty_tag_ids?: string[]
}

export interface ReferralSearchResult {
  organizations: ReferralOrganization[]
  total_count: number
  search_criteria: ReferralSearchCriteria
  payer_name: string
  care_type_names: string[]
  specialty_tag_names?: string[]
  provider_directory_url?: string | null  // Link to payer's official provider directory
}

// ============================================
// DOCUMENT GENERATION
// ============================================

export type ReferralOutputFormat = 'pdf' | 'screen' | 'both'

export interface ReferralDocumentLog {
  id: string
  generated_by_email: string
  generated_by_user_id?: string | null
  payer_id?: string | null
  payer_name: string
  care_type_ids?: string[]
  care_type_names?: string[]
  specialty_tag_ids?: string[]
  specialty_tag_names?: string[]
  organization_count: number
  contact_count: number
  output_format: ReferralOutputFormat
  pdf_storage_path?: string | null
  search_criteria?: ReferralSearchCriteria
  created_at: string
}

export interface GeneratePDFRequest {
  search_criteria: ReferralSearchCriteria
  organizations: ReferralOrganization[]
  payer_name: string
  care_type_names: string[]
  specialty_tag_names?: string[]
}

export interface GeneratePDFResponse {
  success: boolean
  pdf_url?: string
  log_id?: string
  error?: string
}

// ============================================
// API RESPONSES
// ============================================

export interface CareTypesResponse {
  care_types: ReferralCareType[]
}

export interface SpecialtyTagsResponse {
  specialty_tags: ReferralSpecialtyTag[]
  by_category: {
    clinical: ReferralSpecialtyTag[]
    population: ReferralSpecialtyTag[]
    administrative: ReferralSpecialtyTag[]
  }
}

export interface DocumentLogsResponse {
  logs: ReferralDocumentLog[]
  total_count: number
  page: number
  page_size: number
}

// ============================================
// EDITOR MODAL TYPES
// ============================================

export interface ReferralOrgEditorData {
  organization_id: string
  is_referral_destination: boolean
  referral_notes?: string
  referral_internal_notes?: string
  hours_of_operation?: string
  website?: string
  fax?: string
  accepted_payer_ids: string[]
  care_type_ids: string[]
  specialty_tag_ids: string[]
}

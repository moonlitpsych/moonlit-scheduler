// Comprehensive TypeScript mapper for bookability views and provider relationships
// Handles v_bookable_provider_payer view and provides standardized interfaces

import { VIEW_BOOKABLE, VIEW_BOOKABLE_NAMED } from './dbViews'

// Ensure constants are properly exported
const CANONICAL_VIEW = 'v_bookable_provider_payer'
const CANONICAL_VIEW_NAMED = 'v_bookable_provider_payer_named'

// ================================
// DATABASE VIEW INTERFACES
// ================================

/**
 * Raw data from v_bookable_provider_payer view
 * This is the canonical database view structure
 */
export interface BookableProviderPayerView {
  provider_id: string
  payer_id: string
  network_status: 'in_network' | 'supervised'
  billing_provider_id: string | null      // Who bills insurance (attending)
  rendering_provider_id: string | null    // Who provides service (resident)
  effective_date: string
  bookable_from_date: string | null
}

/**
 * Raw data from v_bookable_provider_payer_named view (includes provider info)
 */
export interface BookableProviderPayerNamedView extends BookableProviderPayerView {
  first_name: string
  last_name: string
  title: string
  role: string
  provider_type: string
  is_active: boolean
  is_bookable: boolean
  languages_spoken: string[] | string
  profile_image_url: string | null
  about: string | null
}

/**
 * Provider data from providers table
 */
export interface ProviderData {
  id: string
  first_name: string
  last_name: string
  title: string
  role: string
  provider_type: string
  is_active: boolean
  is_bookable: boolean
  languages_spoken: string[] | string
  profile_image_url: string | null
  about: string | null
  accepts_new_patients: boolean
  list_on_provider_page: boolean
  med_school_org: string | null
  med_school_grad_year: string | null
  residency_org: string | null
  focus_json?: any[] // Focus areas data
}

// ================================
// BUSINESS LOGIC INTERFACES
// ================================

/**
 * Legacy API format - maintains backward compatibility
 * This is what frontend applications expect
 */
export interface BookableProvider {
  // Core provider info
  id: string
  first_name: string
  last_name: string
  title: string
  role: string
  provider_type: string
  is_active: boolean
  is_bookable: boolean
  languages_spoken: string[] | string
  profile_image_url: string | null
  about: string | null
  focus_json?: any[] // Focus areas data
  accepts_new_patients?: boolean
  med_school_org?: string | null
  med_school_grad_year?: string | null
  residency_org?: string | null

  // Network relationship info (legacy format)
  via: 'direct' | 'supervised'
  attending_provider_id: string | null
  supervision_level: 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required' | null
  requires_co_visit: boolean
  effective: string
  bookable_from_date: string | null

  // Service instances for booking
  accepted_services?: Array<{
    service_id: string
    service_instance_id: string
    name?: string
    type?: string
  }>
  
  // Legacy compatibility fields
  network_effective_date: string
  network_status: string
  relationship_type: string
}

/**
 * Supervision relationship details
 */
export interface SupervisionInfo {
  rendering_provider_id: string    // Resident/trainee
  billing_provider_id: string      // Attending supervisor
  supervision_level: 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required'
  requires_co_visit: boolean
  effective_date: string
}

/**
 * Provider availability with supervision context
 */
export interface ProviderAvailability {
  provider_id: string
  provider_name: string
  is_direct: boolean
  supervision_info: SupervisionInfo | null
  available_slots: Array<{
    date: string
    time: string
    duration: number
  }>
}

// ================================
// FIELD MAPPING UTILITIES
// ================================

/**
 * Maps network_status from database to via field for legacy compatibility
 */
export function mapNetworkStatusToVia(networkStatus: string): 'direct' | 'supervised' {
  return networkStatus === 'in_network' ? 'direct' : 'supervised'
}

/**
 * Maps via field back to network_status for database operations
 */
export function mapViaToNetworkStatus(via: string): 'in_network' | 'supervised' {
  return via === 'direct' ? 'in_network' : 'supervised'
}

/**
 * Determines supervision level from network status
 */
export function mapSupervisionLevel(networkStatus: string): SupervisionInfo['supervision_level'] | null {
  switch (networkStatus) {
    case 'supervised':
      return 'sign_off_only' // Default supervision level
    default:
      return null
  }
}

/**
 * Determines if co-visit is required based on supervision level
 */
export function requiresCoVisit(supervisionLevel: SupervisionInfo['supervision_level']): boolean {
  return supervisionLevel === 'co_visit_required'
}

// ================================
// DATA TRANSFORMATION MAPPERS
// ================================

/**
 * Transforms raw database view data to legacy API format
 * Maintains backward compatibility with existing frontend
 */
export function mapViewToLegacyFormat(
  viewData: BookableProviderPayerView,
  providerData: ProviderData
): BookableProvider {
  const via = mapNetworkStatusToVia(viewData.network_status)
  const supervisionLevel = mapSupervisionLevel(viewData.network_status)
  
  return {
    // Core provider info
    id: providerData.id,
    first_name: providerData.first_name,
    last_name: providerData.last_name,
    title: providerData.title,
    role: providerData.role,
    provider_type: providerData.provider_type,
    is_active: providerData.is_active,
    is_bookable: providerData.is_bookable,
    languages_spoken: providerData.languages_spoken,
    profile_image_url: providerData.profile_image_url,
    about: providerData.about,
    focus_json: providerData.focus_json, // Focus areas data
    accepts_new_patients: providerData.accepts_new_patients,
    med_school_org: providerData.med_school_org,
    med_school_grad_year: providerData.med_school_grad_year,
    residency_org: providerData.residency_org,
    
    // Network relationship info (legacy format)
    via,
    attending_provider_id: viewData.billing_provider_id,
    supervision_level: supervisionLevel,
    requires_co_visit: requiresCoVisit(supervisionLevel),
    effective: viewData.effective_date,
    bookable_from_date: viewData.bookable_from_date,
    
    // Legacy compatibility fields
    network_effective_date: viewData.effective_date,
    network_status: viewData.network_status,
    relationship_type: via // Map to old field name
  }
}

/**
 * Transforms named view data (includes provider info) to legacy format
 */
export function mapNamedViewToLegacyFormat(viewData: BookableProviderPayerNamedView): BookableProvider {
  const via = mapNetworkStatusToVia(viewData.network_status)
  const supervisionLevel = mapSupervisionLevel(viewData.network_status)
  
  return {
    // Core provider info (from view)
    id: viewData.provider_id,
    first_name: viewData.first_name,
    last_name: viewData.last_name,
    title: viewData.title,
    role: viewData.role,
    provider_type: viewData.provider_type,
    is_active: viewData.is_active,
    is_bookable: viewData.is_bookable,
    languages_spoken: viewData.languages_spoken,
    profile_image_url: viewData.profile_image_url,
    about: viewData.about,
    focus_json: [], // Named view doesn't include focus areas, would need separate fetch
    
    // Network relationship info
    via,
    attending_provider_id: viewData.billing_provider_id,
    supervision_level: supervisionLevel,
    requires_co_visit: requiresCoVisit(supervisionLevel),
    effective: viewData.effective_date,
    bookable_from_date: viewData.bookable_from_date,
    
    // Legacy compatibility fields
    network_effective_date: viewData.effective_date,
    network_status: viewData.network_status,
    relationship_type: via
  }
}

// ================================
// SUPERVISION UTILITIES
// ================================

/**
 * Extracts supervision information from provider relationship
 */
export function extractSupervisionInfo(provider: BookableProvider): SupervisionInfo | null {
  if (provider.via !== 'supervised' || !provider.attending_provider_id) {
    return null
  }
  
  return {
    rendering_provider_id: provider.id,
    billing_provider_id: provider.attending_provider_id,
    supervision_level: provider.supervision_level || 'sign_off_only',
    requires_co_visit: provider.requires_co_visit,
    effective_date: provider.effective
  }
}

/**
 * Groups providers by supervision relationships
 */
export function groupProvidersBySupervision(providers: BookableProvider[]) {
  const direct = providers.filter(p => p.via === 'direct')
  const supervised = providers.filter(p => p.via === 'supervised')
  
  // Group supervised providers by attending physician
  const supervisionGroups = supervised.reduce((groups, provider) => {
    const attendingId = provider.attending_provider_id || 'unknown'
    if (!groups[attendingId]) {
      groups[attendingId] = []
    }
    groups[attendingId].push(provider)
    return groups
  }, {} as Record<string, BookableProvider[]>)
  
  return {
    direct,
    supervised,
    supervisionGroups,
    stats: {
      total: providers.length,
      direct: direct.length,
      supervised: supervised.length,
      coVisitRequired: providers.filter(p => p.requires_co_visit).length
    }
  }
}

// ================================
// LANGUAGE UTILITIES
// ================================

/**
 * Normalizes languages_spoken field to array format
 */
export function normalizeLanguages(languages: string[] | string | null): string[] {
  if (!languages) return ['English'] // Default
  
  if (Array.isArray(languages)) {
    return languages
  }
  
  if (typeof languages === 'string') {
    try {
      const parsed = JSON.parse(languages)
      return Array.isArray(parsed) ? parsed : [languages]
    } catch {
      return [languages]
    }
  }
  
  return ['English']
}

/**
 * Filters providers by language capability
 */
export function filterProvidersByLanguage(providers: BookableProvider[], language: string): BookableProvider[] {
  if (!language || language === 'English') {
    return providers // English is default, assume all providers speak it
  }
  
  return providers.filter(provider => {
    const languages = normalizeLanguages(provider.languages_spoken)
    return languages.some(lang => 
      lang.toLowerCase().includes(language.toLowerCase())
    )
  })
}

// ================================
// QUERY BUILDERS
// ================================

/**
 * Standard select fields for bookable provider queries
 */
export const BOOKABLE_PROVIDER_SELECT = `
  provider_id,
  payer_id,
  network_status,
  billing_provider_id,
  rendering_provider_id,
  effective_date,
  bookable_from_date
` as const

/**
 * Standard select fields for provider details
 */
export const PROVIDER_DETAILS_SELECT = `
  id,
  first_name,
  last_name,
  title,
  role,
  provider_type,
  is_active,
  is_bookable,
  languages_spoken,
  profile_image_url,
  about,
  accepts_new_patients,
  list_on_provider_page,
  med_school_org,
  med_school_grad_year,
  residency_org
` as const

/**
 * Creates query filter for effective date range
 */
export function createEffectiveDateFilter(startDate: string, endDate?: string) {
  return {
    effective_date: {
      lte: endDate || startDate
    },
    bookable_from_date: {
      lte: endDate || startDate
    }
  }
}

// ================================
// TYPE GUARDS
// ================================

/**
 * Type guard to check if provider has supervision info
 */
export function isSupervised(provider: BookableProvider): provider is BookableProvider & {
  via: 'supervised'
  attending_provider_id: string
} {
  return provider.via === 'supervised' && provider.attending_provider_id !== null
}

/**
 * Type guard to check if provider requires co-visit
 */
export function requiresCoVisitCheck(provider: BookableProvider): boolean {
  return provider.requires_co_visit === true
}

// ================================
// CONSTANTS
// ================================

/**
 * Standard database views for bookability
 */
export const BOOKABILITY_VIEWS = {
  BOOKABLE: CANONICAL_VIEW,
  BOOKABLE_NAMED: CANONICAL_VIEW_NAMED
} as const

/**
 * Re-export canonical view constants for direct usage
 */
export { CANONICAL_VIEW as VIEW_BOOKABLE_CANONICAL, CANONICAL_VIEW_NAMED as VIEW_BOOKABLE_NAMED_CANONICAL }

/**
 * Supervision levels in order of complexity
 */
export const SUPERVISION_LEVELS = [
  'sign_off_only',
  'first_visit_in_person', 
  'co_visit_required'
] as const

/**
 * Default provider languages
 */
export const DEFAULT_LANGUAGES = ['English'] as const
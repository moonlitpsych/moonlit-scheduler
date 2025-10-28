// Provider validation service for admin operations
import { supabaseAdmin } from '@/lib/supabase'
import { Database } from '@/types/database'

type Provider = Database['public']['Tables']['providers']['Row']
type ProviderInsert = Database['public']['Tables']['providers']['Insert']
type ProviderUpdate = Database['public']['Tables']['providers']['Update']

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Validates provider data for creation or updates
 */
export async function validateProviderData(
  data: Partial<ProviderInsert | ProviderUpdate>,
  isUpdate: boolean = false,
  existingProviderId?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = []

  // Required fields for new providers
  if (!isUpdate) {
    if (!data.first_name || data.first_name.trim() === '') {
      errors.push({ field: 'first_name', message: 'First name is required' })
    }
    if (!data.last_name || data.last_name.trim() === '') {
      errors.push({ field: 'last_name', message: 'Last name is required' })
    }
    if (!data.email || data.email.trim() === '') {
      errors.push({ field: 'email', message: 'Email is required' })
    }
  }

  // Email validation
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' })
    } else {
      // Check email uniqueness
      const emailExists = await checkEmailExists(data.email, existingProviderId)
      if (emailExists) {
        errors.push({ field: 'email', message: 'Email already exists for another provider' })
      }
    }
  }

  // NPI validation (optional but must be valid if provided)
  if (data.npi) {
    const npiValid = validateNPI(data.npi)
    if (!npiValid.valid) {
      errors.push({ field: 'npi', message: npiValid.message })
    } else {
      // Check NPI uniqueness
      const npiExists = await checkNPIExists(data.npi, existingProviderId)
      if (npiExists) {
        errors.push({ field: 'npi', message: 'NPI already exists for another provider' })
      }
    }
  }

  // Phone number format validation (optional)
  if (data.phone_number) {
    const phoneValid = validatePhoneNumber(data.phone_number)
    if (!phoneValid.valid) {
      errors.push({ field: 'phone_number', message: phoneValid.message })
    }
  }

  // Med school grad year validation
  if (data.med_school_grad_year) {
    const currentYear = new Date().getFullYear()
    if (data.med_school_grad_year < 1900 || data.med_school_grad_year > currentYear + 10) {
      errors.push({ field: 'med_school_grad_year', message: `Graduation year must be between 1900 and ${currentYear + 10}` })
    }
  }

  // Language validation - accept any non-empty string values
  if (data.languages_spoken && Array.isArray(data.languages_spoken)) {
    const invalidLangs = data.languages_spoken.filter(lang => !lang || typeof lang !== 'string' || lang.trim() === '')
    if (invalidLangs.length > 0) {
      errors.push({ field: 'languages_spoken', message: `Invalid language values: must be non-empty strings` })
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validates NPI format (10 digits)
 */
export function validateNPI(npi: string): { valid: boolean; message: string } {
  if (!npi || npi.trim() === '') {
    return { valid: true, message: 'NPI is optional' }
  }

  const cleanNPI = npi.replace(/\D/g, '')

  if (cleanNPI.length !== 10) {
    return { valid: false, message: 'NPI must be exactly 10 digits' }
  }

  return { valid: true, message: 'Valid NPI' }
}

/**
 * Validates phone number format
 */
export function validatePhoneNumber(phone: string): { valid: boolean; message: string } {
  if (!phone || phone.trim() === '') {
    return { valid: true, message: 'Phone is optional' }
  }

  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '')

  // Should be 10 digits (US) or 11 digits (with country code)
  if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
    return { valid: false, message: 'Phone number must be 10 or 11 digits' }
  }

  return { valid: true, message: 'Valid phone number' }
}

/**
 * Checks if email already exists for another provider
 */
export async function checkEmailExists(email: string, excludeProviderId?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('providers')
    .select('id')
    .eq('email', email.toLowerCase())

  if (excludeProviderId) {
    query = query.neq('id', excludeProviderId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    console.error('Error checking email existence:', error)
    return false
  }

  return (data && data.length > 0)
}

/**
 * Checks if NPI already exists for another provider
 */
export async function checkNPIExists(npi: string, excludeProviderId?: string): Promise<boolean> {
  const cleanNPI = npi.replace(/\D/g, '')

  let query = supabaseAdmin
    .from('providers')
    .select('id')
    .eq('npi', cleanNPI)

  if (excludeProviderId) {
    query = query.neq('id', excludeProviderId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    console.error('Error checking NPI existence:', error)
    return false
  }

  return (data && data.length > 0)
}

/**
 * Sanitizes provider data before database insertion
 */
export function sanitizeProviderData(data: Partial<ProviderInsert | ProviderUpdate>): Partial<ProviderInsert | ProviderUpdate> {
  const sanitized: any = {}

  // Trim string fields
  const stringFields = [
    'first_name', 'last_name', 'email', 'email_custom', 'phone_number',
    'fax_number', 'title', 'role', 'provider_type', 'address',
    'med_school_org', 'residency_org', 'about', 'what_i_look_for_in_a_patient'
  ]

  for (const field of stringFields) {
    if (data[field as keyof typeof data]) {
      sanitized[field] = (data[field as keyof typeof data] as string).trim()
    }
  }

  // Normalize email to lowercase
  if (data.email) {
    sanitized.email = data.email.toLowerCase()
  }

  // Clean NPI (remove non-digits)
  if (data.npi) {
    sanitized.npi = data.npi.replace(/\D/g, '')
  }

  // Normalize phone numbers (digits only)
  if (data.phone_number) {
    const digitsOnly = data.phone_number.replace(/\D/g, '')
    // Handle 11-digit with country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      sanitized.phone_number = digitsOnly.substring(1)
    } else {
      sanitized.phone_number = digitsOnly
    }
  }

  if (data.fax_number) {
    const digitsOnly = data.fax_number.replace(/\D/g, '')
    // Handle 11-digit with country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      sanitized.fax_number = digitsOnly.substring(1)
    } else {
      sanitized.fax_number = digitsOnly
    }
  }

  // Copy other fields as-is
  const otherFields = [
    'is_active', 'is_bookable', 'list_on_provider_page', 'accepts_new_patients',
    'telehealth_enabled', 'profile_completed', 'languages_spoken',
    'booking_buffer_minutes', 'max_daily_appointments', 'med_school_grad_year',
    'profile_image_url', 'athena_provider_id', 'caqh_provider_id',
    'auth_user_id', 'role_id', 'npi', 'date_of_birth', 'location_of_birth',
    'provider_sex', 'bank_account_number', 'bank_routing_number',
    'malpractice_insurance_id', 'malpractice_insurance_expiration',
    'calendar_source_id', 'utah_id', 'personal_booking_url'
  ]

  for (const field of otherFields) {
    if (data[field as keyof typeof data] !== undefined) {
      sanitized[field] = data[field as keyof typeof data]
    }
  }

  return sanitized
}

/**
 * Validates provider status transition
 */
export function validateStatusTransition(
  currentStatus: { is_active: boolean; is_bookable: boolean },
  newStatus: { is_active?: boolean; is_bookable?: boolean }
): ValidationResult {
  const errors: ValidationError[] = []

  // Cannot make provider bookable if not active
  if (newStatus.is_active === false && newStatus.is_bookable === true) {
    errors.push({
      field: 'is_bookable',
      message: 'Cannot make inactive provider bookable. Set is_active=true first.'
    })
  }

  // Warn if making non-bookable while active (this is valid but uncommon)
  // This is just a soft warning, not an error

  return {
    valid: errors.length === 0,
    errors
  }
}

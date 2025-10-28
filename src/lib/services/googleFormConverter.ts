/**
 * Google Form to Provider Data Converter
 *
 * Converts the "Join Moonlit as a psychiatry resident" Google Form responses
 * into provider database format for bulk import
 */

export interface GoogleFormRow {
  'Email Address': string
  'Your first name': string
  'Your last name': string
  "What's your NPI?": string
  'What language(s) would you be comfortable conducting patient interviews in?': string
  'What is your home address? ': string
  "What's your phone number?": string
  "What's your fax number?": string
  "What's your date of birth?": string
  'What city and state were you born in?': string
  'What degree do you have?': string
  'What medical school did you attend?': string
  'What year did you complete medical school?': string
  'What residency program are you in or did you participate in?': string
  'What year will you/did you complete your residency?': string
  'Please upload a headshot of yourself.': string
  'Do you have a UtahID? If so, what is it?': string
  'Do you have a CAQH account? If you do, record your CAQH ID. If you don\'t, leave this answer blank and Miriam will contact you about creating an account for you. ': string
}

export interface ProviderImportRow {
  first_name: string
  last_name: string
  email: string
  npi: string
  phone_number: string
  fax_number: string
  title: string
  role: string
  provider_type: string
  address: string
  date_of_birth: string
  location_of_birth: string
  med_school_org: string
  med_school_grad_year: string
  residency_org: string
  languages_spoken: string
  profile_image_url: string
  utah_id: string
  caqh_provider_id: string
  is_active: string
  is_bookable: string
  list_on_provider_page: string
  accepts_new_patients: string
  telehealth_enabled: string
}

/**
 * Parse comma-separated languages into array format
 */
function parseLanguages(languageString: string): string {
  if (!languageString || languageString.trim() === '') {
    return 'English'
  }

  // Clean up the string and split by comma
  const languages = languageString
    .split(',')
    .map(lang => lang.trim())
    .filter(lang => lang.length > 0)

  // Return as comma-separated for CSV
  return languages.join(',')
}

/**
 * Extract year from various date formats
 */
function extractYear(yearString: string): string {
  if (!yearString) return ''

  // Remove any non-digit characters and get first 4 digits
  const match = yearString.match(/\d{4}/)
  return match ? match[0] : yearString
}

/**
 * Clean NPI - remove any non-digit characters
 */
function cleanNPI(npi: string): string {
  if (!npi || npi.toLowerCase() === 'n/a' || npi.toLowerCase() === 'asdf') return ''
  return npi.replace(/\D/g, '')
}

/**
 * Clean and normalize phone number to digits only
 */
function cleanPhone(phone: string): string {
  if (!phone || phone.toLowerCase() === 'n/a' || phone.toLowerCase() === 'asdf') return ''

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // Handle 11-digit numbers with leading 1 (US country code)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly.substring(1)
  }

  return digitsOnly
}

/**
 * Determines if a provider is an attending or resident based on residency completion
 */
function determineProviderType(residencyCompletionYear: string): string {
  if (!residencyCompletionYear || residencyCompletionYear.trim() === '') {
    return 'resident physician' // No completion year = still in residency
  }

  const year = parseInt(extractYear(residencyCompletionYear))
  if (isNaN(year)) {
    return 'resident physician' // Can't parse year = assume resident
  }

  const currentYear = new Date().getFullYear()
  if (year <= currentYear) {
    return 'attending physician' // Completed residency = attending
  } else {
    return 'resident physician' // Future year = still in residency
  }
}

/**
 * Converts a Google Form response row to provider import format
 */
export function convertGoogleFormRow(row: any): ProviderImportRow {
  const languages = parseLanguages(row['What language(s) would you be comfortable conducting patient interviews in?'])
  const providerType = determineProviderType(row['What year will you/did you complete your residency?'])

  return {
    first_name: row['Your first name']?.trim() || '',
    last_name: row['Your last name']?.trim() || '',
    email: row['Email Address']?.trim().toLowerCase() || '',
    npi: cleanNPI(row["What's your NPI?"]),
    phone_number: cleanPhone(row["What's your phone number?"]),
    fax_number: cleanPhone(row["What's your fax number?"]),
    title: row['What degree do you have?']?.trim() || '',
    role: 'provider', // All providers have role 'provider' (admin is separate)
    provider_type: providerType, // Attending if completed residency, otherwise resident
    address: row['What is your home address? ']?.trim() || '',
    date_of_birth: row["What's your date of birth?"]?.trim() || '',
    location_of_birth: row['What city and state were you born in?']?.trim() || '',
    med_school_org: row['What medical school did you attend?']?.trim() || '',
    med_school_grad_year: extractYear(row['What year did you complete medical school?']),
    residency_org: row['What residency program are you in or did you participate in?']?.trim() || '',
    languages_spoken: languages,
    profile_image_url: row['Please upload a headshot of yourself.']?.trim() || '',
    utah_id: row['Do you have a UtahID? If so, what is it?']?.trim() || '',
    caqh_provider_id: row['Do you have a CAQH account? If you do, record your CAQH ID. If you don\'t, leave this answer blank and Miriam will contact you about creating an account for you. ']?.trim() || '',
    // Default status for new providers (both residents and attendings from onboarding form)
    is_active: 'true', // Active so they can be assigned
    is_bookable: 'false', // Start as not bookable until fully onboarded
    list_on_provider_page: 'false', // Don't list publicly until ready
    accepts_new_patients: 'false', // Don't accept new patients until approved
    telehealth_enabled: 'true' // Enable telehealth capability by default
  }
}

/**
 * Converts an array of Google Form rows to provider import format
 */
export function convertGoogleFormData(rows: any[]): ProviderImportRow[] {
  return rows.map(row => convertGoogleFormRow(row))
}

/**
 * Detects if CSV data is from the Google Form based on column headers
 */
export function isGoogleFormData(firstRow: any): boolean {
  const googleFormColumns = [
    'Email Address',
    'Your first name',
    'Your last name',
    "What's your NPI?",
    'What language(s) would you be comfortable conducting patient interviews in?'
  ]

  // Check if at least 3 of the Google Form columns are present
  const matchCount = googleFormColumns.filter(col => col in firstRow).length
  return matchCount >= 3
}

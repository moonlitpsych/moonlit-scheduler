/**
 * Profile Completion Logic
 *
 * Determines if a provider profile is complete enough to be considered "Active"
 * vs "Onboarding"
 */

export interface ProfileCompletionResult {
  isComplete: boolean
  missingFields: string[]
  completionPercentage: number
}

/**
 * Checks if a provider profile meets all completion requirements
 *
 * Required for completion:
 * - Status: is_active = true, list_on_provider_page = true
 * - Identity: first_name, last_name, email
 * - Credentials: npi, role, provider_type, title
 * - Contact: phone_number
 * - Profile: about (min 50 chars), languages_spoken (at least 1)
 * - Education: med_school_org, residency_org
 */
export function checkProfileCompletion(provider: any): ProfileCompletionResult {
  const missingFields: string[] = []
  const requiredFields = [
    // Status flags
    { field: 'is_active', check: (p: any) => p.is_active === true, label: 'Active Status' },
    { field: 'list_on_provider_page', check: (p: any) => p.list_on_provider_page === true, label: 'Listed on Provider Page' },

    // Identity
    { field: 'first_name', check: (p: any) => p.first_name && p.first_name.trim() !== '', label: 'First Name' },
    { field: 'last_name', check: (p: any) => p.last_name && p.last_name.trim() !== '', label: 'Last Name' },
    { field: 'email', check: (p: any) => p.email && p.email.trim() !== '', label: 'Email' },

    // Credentials
    { field: 'npi', check: (p: any) => p.npi && p.npi.toString().trim() !== '', label: 'NPI Number' },
    { field: 'role', check: (p: any) => p.role && p.role.trim() !== '', label: 'Role' },
    { field: 'provider_type', check: (p: any) => p.provider_type && p.provider_type.trim() !== '', label: 'Provider Type' },
    { field: 'title', check: (p: any) => p.title && p.title.trim() !== '', label: 'Title (MD, DO, etc.)' },

    // Contact
    { field: 'phone_number', check: (p: any) => p.phone_number && p.phone_number.trim() !== '', label: 'Phone Number' },

    // Public Profile
    { field: 'about', check: (p: any) => p.about && p.about.trim().length >= 50, label: 'About/Bio (min 50 characters)' },
    { field: 'languages_spoken', check: (p: any) => Array.isArray(p.languages_spoken) && p.languages_spoken.length > 0, label: 'Languages Spoken' },

    // Education
    { field: 'med_school_org', check: (p: any) => p.med_school_org && p.med_school_org.trim() !== '', label: 'Medical School' },
    { field: 'residency_org', check: (p: any) => p.residency_org && p.residency_org.trim() !== '', label: 'Residency Program' },
  ]

  // Check each required field
  for (const req of requiredFields) {
    if (!req.check(provider)) {
      missingFields.push(req.label)
    }
  }

  const completionPercentage = Math.round(
    ((requiredFields.length - missingFields.length) / requiredFields.length) * 100
  )

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPercentage
  }
}

/**
 * Get a human-readable completion status message
 */
export function getCompletionMessage(result: ProfileCompletionResult): string {
  if (result.isComplete) {
    return 'Profile is complete and ready for active status'
  }

  const missing = result.missingFields.join(', ')
  return `Profile is ${result.completionPercentage}% complete. Missing: ${missing}`
}

// Shared Provider types for consistency across the application

export interface Provider {
    id: string
    first_name: string
    last_name: string
    full_name?: string // Some APIs return this directly
    title?: string
    profile_image_url?: string
    bio?: string
    about?: string // About text from database
    what_i_look_for_in_a_patient?: string // What they look for in patients
    med_school_org?: string // Medical school
    med_school_grad_year?: number // Graduation year
    residency_org?: string // Residency organization
    specialty?: string // Single specialty (from some APIs)
    specialties?: string[] // Multiple specialties array
    languages_spoken?: string[]
    accepts_new_patients?: boolean
    new_patient_status?: string // Custom status message
    next_available?: string
    state_licenses?: string[]
    accepted_insurances?: string[]
    intakeq_practitioner_id?: string // For IntakeQ integration
    provider_name?: string // Sometimes used in appointment data
}

export type ProviderCardVariant = 
    | 'selection'      // For provider selection in booking flow
    | 'calendar'       // Compact version for calendar view
    | 'summary'        // Detailed version for appointment summary
    | 'directory'      // Full directory listing
    | 'compact'        // Small version for confirmation

export interface ProviderDisplayOptions {
    showAvailability?: boolean
    showInsurance?: boolean
    showLicensing?: boolean
    showSpecialties?: boolean
    showLanguages?: boolean
    showBio?: boolean
    variant?: ProviderCardVariant
}
/**
 * IntakeQ Client Enrichment Service
 *
 * V2.0 Feature: PRACTICEQ_ENRICH_ENABLED
 *
 * Enriches IntakeQ client creation with additional fields:
 * - Normalized phone
 * - Normalized date of birth
 * - Insurance company name (mapped from payer)
 * - Insurance member ID (normalized)
 * - Referring partner contact info
 */

import { supabaseAdmin } from '@/lib/supabase'
import { featureFlags } from '@/lib/config/featureFlags'

export interface EnrichedClientData {
  // Basic fields (existing)
  FirstName: string
  LastName: string
  Email: string

  // V2.0 enriched fields
  Phone?: string // Normalized: (XXX) XXX-XXXX or XXXXXXXXXX
  DateOfBirth?: string // Normalized: YYYY-MM-DD
  PrimaryInsuranceName?: string // Resolved from payer mapping
  PrimaryMemberID?: string // Normalized: uppercase, alphanumeric
  ReferringProvider?: string // Referring partner name
  ReferringProviderPhone?: string // Referring partner phone
  ReferringProviderEmail?: string // Referring partner email
}

export interface EnrichmentResult {
  enrichedData: EnrichedClientData
  enrichmentApplied: boolean
  enrichmentFields: string[] // List of fields that were enriched
  errors: string[] // Non-fatal errors during enrichment
}

/**
 * Normalize phone number to IntakeQ accepted format
 * Accepts: (801) 555-1234, 801-555-1234, 8015551234
 * Returns: (801) 555-1234 or null if invalid
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Must be 10 digits (US phone number)
  if (digits.length !== 10) {
    console.warn(`⚠️ Invalid phone number length: ${phone} (${digits.length} digits)`)
    return null
  }

  // Format as (XXX) XXX-XXXX
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Normalize date of birth to IntakeQ accepted format
 * Accepts: YYYY-MM-DD, MM/DD/YYYY, various ISO formats
 * Returns: YYYY-MM-DD or null if invalid
 */
export function normalizeDateOfBirth(dob: string | null | undefined): string | null {
  if (!dob) return null

  try {
    const date = new Date(dob)

    // Check if valid date
    if (isNaN(date.getTime())) {
      console.warn(`⚠️ Invalid date of birth: ${dob}`)
      return null
    }

    // Format as YYYY-MM-DD
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  } catch (error) {
    console.warn(`⚠️ Error normalizing date of birth: ${dob}`, error)
    return null
  }
}

/**
 * Normalize insurance member ID
 * Accepts: Various formats with spaces, dashes, etc.
 * Returns: UPPERCASE alphanumeric string or null
 */
export function normalizeMemberID(memberId: string | null | undefined): string | null {
  if (!memberId) return null

  // Remove spaces, dashes, and special characters; keep alphanumeric only
  const normalized = memberId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  if (normalized.length === 0) {
    console.warn(`⚠️ Member ID became empty after normalization: ${memberId}`)
    return null
  }

  return normalized
}

/**
 * Resolve payer to IntakeQ insurance company name
 * Uses payer_external_mappings table
 */
export async function resolveInsuranceCompanyName(payerId: string): Promise<string | null> {
  try {
    // First, try to get mapped name from payer_external_mappings
    const { data: mapping, error: mappingError } = await supabaseAdmin
      .from('payer_external_mappings')
      .select('value')
      .eq('payer_id', payerId)
      .eq('system', 'intakeq')
      .eq('key_name', 'insurance_company_name')
      .maybeSingle()

    if (mapping && !mappingError) {
      console.log(`✅ Resolved payer ${payerId} to IntakeQ insurance: ${mapping.value}`)
      return mapping.value
    }

    // Fallback: use payer name directly
    const { data: payer, error: payerError } = await supabaseAdmin
      .from('payers')
      .select('name')
      .eq('id', payerId)
      .single()

    if (payer && !payerError) {
      console.warn(`⚠️ No IntakeQ mapping for payer ${payerId}, using payer name: ${payer.name}`)
      return payer.name
    }

    console.error(`❌ Failed to resolve insurance company name for payer ${payerId}`)
    return null

  } catch (error) {
    console.error(`❌ Error resolving insurance company name:`, error)
    return null
  }
}

/**
 * Get referring partner contact info from ROI consent
 * (if patient came through partner referral)
 */
export async function getReferringPartnerInfo(patientId: string): Promise<{
  name?: string
  phone?: string
  email?: string
} | null> {
  try {
    // Check if patient has ROI consent with partner info
    const { data: consent, error } = await supabaseAdmin
      .from('roi_consents')
      .select('referring_contact')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!consent || error || !consent.referring_contact) {
      return null
    }

    const contact = consent.referring_contact as any

    return {
      name: contact.name || contact.organization || null,
      phone: normalizePhone(contact.phone) || null,
      email: contact.email || null
    }

  } catch (error) {
    console.error(`❌ Error getting referring partner info:`, error)
    return null
  }
}

/**
 * Main enrichment function
 * Enriches basic patient data with V2.0 fields
 */
export async function enrichClientData(
  patientId: string,
  payerId: string | null,
  basicData: {
    FirstName: string
    LastName: string
    Email: string
    Phone?: string | null
    DateOfBirth?: string | null
  }
): Promise<EnrichmentResult> {
  const enrichmentFields: string[] = []
  const errors: string[] = []

  // Start with basic data
  const enrichedData: EnrichedClientData = {
    FirstName: basicData.FirstName,
    LastName: basicData.LastName,
    Email: basicData.Email
  }

  // Skip enrichment if feature flag is disabled
  if (!featureFlags.practiceqEnrich) {
    console.log('ℹ️ PracticeQ enrichment disabled (feature flag OFF)')
    return {
      enrichedData,
      enrichmentApplied: false,
      enrichmentFields: [],
      errors: []
    }
  }

  console.log(`🔄 V2.0: Enriching client data for patient ${patientId}...`)

  // Enrich: Phone
  if (basicData.Phone) {
    const normalizedPhone = normalizePhone(basicData.Phone)
    if (normalizedPhone) {
      enrichedData.Phone = normalizedPhone
      enrichmentFields.push('Phone')
    } else {
      errors.push(`Invalid phone number: ${basicData.Phone}`)
    }
  }

  // Enrich: Date of Birth
  if (basicData.DateOfBirth) {
    const normalizedDOB = normalizeDateOfBirth(basicData.DateOfBirth)
    if (normalizedDOB) {
      enrichedData.DateOfBirth = normalizedDOB
      enrichmentFields.push('DateOfBirth')
    } else {
      errors.push(`Invalid date of birth: ${basicData.DateOfBirth}`)
    }
  }

  // Enrich: Insurance Company Name (from payer)
  if (payerId) {
    const insuranceName = await resolveInsuranceCompanyName(payerId)
    if (insuranceName) {
      enrichedData.PrimaryInsuranceName = insuranceName
      enrichmentFields.push('PrimaryInsuranceName')
    } else {
      errors.push(`Could not resolve insurance company name for payer ${payerId}`)
    }

    // Enrich: Member ID (from patient insurance policies)
    try {
      const { data: policy, error: policyError } = await supabaseAdmin
        .from('patient_insurance_policies')
        .select('member_id')
        .eq('patient_id', patientId)
        .eq('payer_id', payerId)
        .eq('is_active', true)
        .maybeSingle()

      if (policy && !policyError && policy.member_id) {
        const normalizedMemberID = normalizeMemberID(policy.member_id)
        if (normalizedMemberID) {
          enrichedData.PrimaryMemberID = normalizedMemberID
          enrichmentFields.push('PrimaryMemberID')
        } else {
          errors.push(`Invalid member ID: ${policy.member_id}`)
        }
      }
    } catch (error: any) {
      errors.push(`Error fetching member ID: ${error.message}`)
    }
  }

  // Enrich: Referring Partner Info
  const referringPartner = await getReferringPartnerInfo(patientId)
  if (referringPartner) {
    if (referringPartner.name) {
      enrichedData.ReferringProvider = referringPartner.name
      enrichmentFields.push('ReferringProvider')
    }
    if (referringPartner.phone) {
      enrichedData.ReferringProviderPhone = referringPartner.phone
      enrichmentFields.push('ReferringProviderPhone')
    }
    if (referringPartner.email) {
      enrichedData.ReferringProviderEmail = referringPartner.email
      enrichmentFields.push('ReferringProviderEmail')
    }
  }

  const enrichmentApplied = enrichmentFields.length > 0

  console.log(`✅ V2.0: Enrichment complete. Applied ${enrichmentFields.length} fields:`, enrichmentFields)
  if (errors.length > 0) {
    console.warn(`⚠️ V2.0: Enrichment had ${errors.length} non-fatal errors:`, errors)
  }

  return {
    enrichedData,
    enrichmentApplied,
    enrichmentFields,
    errors
  }
}

/**
 * IntakeQ Client Upsert Service - V2.0 Enhanced
 *
 * Provides robust client upsert with:
 * - Duplicate detection using composite matching (name+DOB, DOB+phone, DOB+memberId)
 * - Insurance enrichment from payer_external_mappings
 * - Contact/case manager support
 * - Normalized phone and DOB formats
 * - Audit logging
 */

import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from './intakeQService'
import { normalizePhone, normalizeDateOfBirth, normalizeMemberID } from './intakeqEnrichment'
import { logIntakeqSync } from './intakeqAudit'
import { sendEmail } from './emailService'
import { featureFlags } from '@/lib/config/featureFlags'
import { toIntakeQAlias, isValidEmail } from '@/lib/utils/emailAlias'

export interface ClientUpsertRequest {
  // Basic fields
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  dateOfBirth?: string | null

  // Insurance fields
  payerId?: string | null
  memberId?: string | null
  groupNumber?: string | null

  // Contact/case manager fields
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null

  // Context
  appointmentId?: string | null // For audit trail
  patientId?: string | null // For linking to our DB

  // V2.0: Identity matching metadata
  identityMatch?: 'strong' | 'fallback' | 'none' // How patient was matched/created
}

export interface ClientUpsertResult {
  intakeqClientId: string
  isNewClient: boolean
  isDuplicate: boolean
  duplicateClients?: Array<{
    id: string
    name: string
    dob?: string
    email?: string
  }>
  enrichedFields: string[]
  errors: string[]
}

interface IntakeQClientSearchResult {
  Id: string
  FirstName: string
  LastName: string
  Email: string
  Phone?: string
  DateOfBirth?: string
  PrimaryInsuranceName?: string
  PrimaryMemberID?: string
  EmergencyContactName?: string
  EmergencyContactPhone?: string
}

interface EmailSelectionResult {
  intakeqEmail: string
  aliasApplied: boolean
  aliasReason: 'duplicate_in_db' | 'duplicate_in_intakeq' | null
}

/**
 * Select the appropriate email to send to IntakeQ
 *
 * If feature flag is disabled or email is unique, use canonical email.
 * Otherwise, check for email conflicts and use alias if needed.
 */
async function selectIntakeQEmail(
  canonicalEmail: string,
  patientId: string,
  existingAlias: string | null
): Promise<EmailSelectionResult> {
  // Feature flag check
  if (!featureFlags.practiceqAliasEmailsForDuplicates) {
    return {
      intakeqEmail: canonicalEmail,
      aliasApplied: false,
      aliasReason: null
    }
  }

  // If we already have an alias stored, reuse it for consistency
  if (existingAlias) {
    console.log(`🔄 Reusing existing IntakeQ email alias: ${existingAlias}`)
    return {
      intakeqEmail: existingAlias,
      aliasApplied: true,
      aliasReason: 'duplicate_in_db' // Original reason stored
    }
  }

  if (!isValidEmail(canonicalEmail)) {
    console.warn(`⚠️ Invalid email format: ${canonicalEmail}`)
    return {
      intakeqEmail: canonicalEmail,
      aliasApplied: false,
      aliasReason: null
    }
  }

  try {
    // Check if another patient in our DB is using this canonical email
    const { data: otherPatients, error } = await supabaseAdmin
      .from('patients')
      .select('id, email, intakeq_email_alias')
      .eq('email', canonicalEmail.toLowerCase())
      .neq('id', patientId)
      .limit(1)

    if (error) {
      console.error('❌ Error checking for email conflicts in DB:', error)
      // On error, use canonical email (fail open)
      return {
        intakeqEmail: canonicalEmail,
        aliasApplied: false,
        aliasReason: null
      }
    }

    // If another patient has this email, we need to use an alias
    if (otherPatients && otherPatients.length > 0) {
      const alias = toIntakeQAlias(canonicalEmail, patientId)
      console.log(`📧 Email conflict detected in DB - using alias: ${alias}`)
      return {
        intakeqEmail: alias,
        aliasApplied: true,
        aliasReason: 'duplicate_in_db'
      }
    }

    // Check IntakeQ for existing client with this email
    try {
      const existingClient = await intakeQService.makeRequest<IntakeQClientSearchResult | null>(
        `/clients/search?email=${encodeURIComponent(canonicalEmail)}`,
        { method: 'GET' }
      )

      if (existingClient && existingClient.Id) {
        // Client exists in IntakeQ - check if it's ours
        const { data: ourPatient } = await supabaseAdmin
          .from('patients')
          .select('id')
          .eq('id', patientId)
          .eq('intakeq_client_id', existingClient.Id)
          .single()

        if (!ourPatient) {
          // IntakeQ has this email but it's not linked to this patient - use alias
          const alias = toIntakeQAlias(canonicalEmail, patientId)
          console.log(`📧 Email conflict detected in IntakeQ - using alias: ${alias}`)
          return {
            intakeqEmail: alias,
            aliasApplied: true,
            aliasReason: 'duplicate_in_intakeq'
          }
        }
      }
    } catch (intakeqError) {
      // IntakeQ search failed - proceed with canonical email
      console.warn('⚠️ IntakeQ email search failed, using canonical email:', intakeqError)
    }

    // No conflicts found - use canonical email
    return {
      intakeqEmail: canonicalEmail,
      aliasApplied: false,
      aliasReason: null
    }

  } catch (error) {
    console.error('❌ Unexpected error in selectIntakeQEmail:', error)
    // Fail open - use canonical email
    return {
      intakeqEmail: canonicalEmail,
      aliasApplied: false,
      aliasReason: null
    }
  }
}

/**
 * Search for existing IntakeQ clients using multiple matching strategies
 */
async function findExistingClients(
  firstName: string,
  lastName: string,
  dob: string | null,
  phone: string | null,
  memberId: string | null
): Promise<IntakeQClientSearchResult[]> {
  console.log('🔍 Searching for existing IntakeQ clients...')

  try {
    // Get all clients from IntakeQ (we'll filter locally for composite matching)
    const allClients = await intakeQService.makeRequest<IntakeQClientSearchResult[]>('/clients', {
      method: 'GET'
    })

    const normalizedDob = normalizeDateOfBirth(dob)
    const normalizedPhone = normalizePhone(phone)
    const normalizedMemberId = normalizeMemberID(memberId)

    const matches: IntakeQClientSearchResult[] = []
    const possibleDuplicates: IntakeQClientSearchResult[] = []

    for (const client of allClients) {
      const clientFirstName = client.FirstName?.toLowerCase()
      const clientLastName = client.LastName?.toLowerCase()
      const clientDob = normalizeDateOfBirth(client.DateOfBirth)
      const clientPhone = normalizePhone(client.Phone)
      const clientMemberId = normalizeMemberID(client.PrimaryMemberID)

      // Strategy 1: Strong match - Name + DOB
      if (clientFirstName === firstName.toLowerCase() &&
          clientLastName === lastName.toLowerCase() &&
          clientDob === normalizedDob && normalizedDob) {
        console.log(`✅ Strong match found (name+DOB): Client ${client.Id}`)
        matches.push(client)
        continue
      }

      // Strategy 2: Fallback match - DOB + Phone
      if (clientDob === normalizedDob && normalizedDob &&
          clientPhone === normalizedPhone && normalizedPhone) {
        console.log(`⚠️ Possible duplicate found (DOB+phone): Client ${client.Id}`)
        possibleDuplicates.push(client)
        continue
      }

      // Strategy 3: Fallback match - DOB + Member ID
      if (clientDob === normalizedDob && normalizedDob &&
          clientMemberId === normalizedMemberId && normalizedMemberId) {
        console.log(`⚠️ Possible duplicate found (DOB+memberId): Client ${client.Id}`)
        possibleDuplicates.push(client)
      }
    }

    // Return strong matches first, then possible duplicates
    return [...matches, ...possibleDuplicates]

  } catch (error) {
    console.error('❌ Error searching IntakeQ clients:', error)
    // Return empty array on search failure - we'll create a new client
    return []
  }
}

/**
 * Get insurance company name from payer_external_mappings
 */
async function getInsuranceCompanyName(payerId: string): Promise<string | null> {
  try {
    console.log(`🔍 [INSURANCE DEBUG] Looking up insurance name for payer ${payerId}`)

    const { data, error } = await supabaseAdmin
      .from('payer_external_mappings')
      .select('value')
      .eq('payer_id', payerId)
      .eq('system', 'practiceq')
      .eq('key_name', 'insurance_company_name')
      .single()

    if (error || !data) {
      console.log(`⚠️ No PracticeQ insurance mapping for payer ${payerId}`)
      // Fallback: get the raw payer name
      const { data: payer } = await supabaseAdmin
        .from('payers')
        .select('name')
        .eq('id', payerId)
        .single()

      console.log(`🔍 [INSURANCE DEBUG] Using fallback payer name: ${payer?.name}`)
      return payer?.name || null
    }

    console.log(`🔍 [INSURANCE DEBUG] Found mapping: ${data.value}`)
    return data.value
  } catch (error) {
    console.error('❌ Error getting insurance company name:', error)
    return null
  }
}

/**
 * Update an existing IntakeQ client with missing fields
 */
async function updateClient(
  clientId: string,
  updates: Partial<{
    Phone: string
    DateOfBirth: string
    PrimaryInsuranceName: string
    PrimaryMemberID: string
    PrimaryGroupNumber: string
    EmergencyContactName: string
    EmergencyContactPhone: string
  }>
): Promise<void> {
  if (Object.keys(updates).length === 0) {
    console.log('ℹ️ No updates needed for client')
    return
  }

  console.log(`🔄 Updating IntakeQ client ${clientId} with:`, Object.keys(updates))
  console.log('🔍 [INTAKEQ DEBUG] Update payload:', JSON.stringify(updates, null, 2))

  // IntakeQ requires full client object for updates
  // First fetch the complete client data
  const fullClient = await intakeQService.makeRequest<any>(
    `/clients/${clientId}`,
    { method: 'GET' }
  )

  // Merge updates with existing data
  const updatePayload = {
    ...fullClient,
    ...updates,
    Id: clientId  // Ensure ID is always present
  }

  const updateResponse = await intakeQService.makeRequest('/clients', {
    method: 'PUT',
    body: JSON.stringify(updatePayload)
  })

  console.log(`✅ Updated IntakeQ client ${clientId}`)
  console.log('🔍 [INTAKEQ DEBUG] Update response:', JSON.stringify(updateResponse, null, 2))
}

/**
 * Create a pinned note in IntakeQ for audit trail
 */
async function createPinnedNote(
  clientId: string,
  note: string
): Promise<void> {
  try {
    console.log(`📌 Creating pinned note for client ${clientId}`)

    await intakeQService.makeRequest(`/clients/${clientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        Text: note,
        IsPinned: true,
        CreatedDate: new Date().toISOString()
      })
    })

    console.log(`✅ Created pinned note for client ${clientId}`)
  } catch (error) {
    console.error(`⚠️ Failed to create pinned note:`, error)
    // Non-critical - don't throw
  }
}

/**
 * Main upsert function - finds or creates IntakeQ client with enrichment
 */
export async function upsertPracticeQClient(
  request: ClientUpsertRequest
): Promise<ClientUpsertResult> {
  const startTime = Date.now()
  const enrichedFields: string[] = []
  const errors: string[] = []

  try {
    // Normalize input data
    const normalizedPhone = normalizePhone(request.phone)
    const normalizedDob = normalizeDateOfBirth(request.dateOfBirth)
    const normalizedMemberId = normalizeMemberID(request.memberId)

    if (normalizedPhone) enrichedFields.push('phone')
    if (normalizedDob) enrichedFields.push('dob')

    // Get existing patient data if patientId provided (for alias check)
    let existingAlias: string | null = null
    if (request.patientId) {
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('intakeq_email_alias')
        .eq('id', request.patientId)
        .single()

      existingAlias = patient?.intakeq_email_alias || null
    }

    // Select appropriate email for IntakeQ (canonical or alias)
    const emailSelection = await selectIntakeQEmail(
      request.email,
      request.patientId || '',
      existingAlias
    )

    console.log('📧 Email selection result:', {
      canonical: request.email,
      intakeq: emailSelection.intakeqEmail,
      aliasApplied: emailSelection.aliasApplied,
      reason: emailSelection.aliasReason
    })

    // Search for existing clients
    const existingClients = await findExistingClients(
      request.firstName,
      request.lastName,
      request.dateOfBirth || null,
      request.phone || null,
      request.memberId || null
    )

    // Prepare insurance data if payerId provided
    let insuranceCompanyName: string | null = null
    if (request.payerId) {
      insuranceCompanyName = await getInsuranceCompanyName(request.payerId)
      if (insuranceCompanyName) {
        enrichedFields.push('insurance')
      }
    }

    // Separate strong matches from fallback matches
    const strongMatches = existingClients.filter(client => {
      const clientFirstName = client.FirstName?.toLowerCase()
      const clientLastName = client.LastName?.toLowerCase()
      const clientDob = normalizeDateOfBirth(client.DateOfBirth)

      return clientFirstName === request.firstName.toLowerCase() &&
             clientLastName === request.lastName.toLowerCase() &&
             clientDob === normalizedDob && normalizedDob
    })

    const fallbackMatches = existingClients.filter(client => !strongMatches.includes(client))

    // Only update if we have a strong match (name+DOB)
    if (strongMatches.length > 0) {
      const primaryClient = strongMatches[0]
      console.log(`✅ Found strong match (name+DOB): Client ${primaryClient.Id}`)

      // Update missing fields
      const updates: any = {}

      if (!primaryClient.Phone && normalizedPhone) {
        updates.Phone = normalizedPhone
        enrichedFields.push('Phone')
      }
      if (!primaryClient.DateOfBirth && normalizedDob) {
        updates.DateOfBirth = normalizedDob
        enrichedFields.push('DateOfBirth')
      }
      // Use correct IntakeQ field names for insurance
      if (!primaryClient.PrimaryInsuranceCompany && insuranceCompanyName) {
        updates.PrimaryInsuranceCompany = insuranceCompanyName
        enrichedFields.push('PrimaryInsuranceCompany')
      }
      if (!primaryClient.PrimaryInsurancePolicyNumber && normalizedMemberId) {
        updates.PrimaryInsurancePolicyNumber = normalizedMemberId
        enrichedFields.push('PrimaryInsurancePolicyNumber')
      }
      if (request.groupNumber && !primaryClient.PrimaryInsuranceGroupNumber) {
        updates.PrimaryInsuranceGroupNumber = request.groupNumber
        enrichedFields.push('PrimaryInsuranceGroupNumber')
      }

      // Add contact info to Additional Information (public API limitation)
      if (request.contactName) {
        const contactInfo = [
          `Case Manager/Contact:`,
          `Name: ${request.contactName}`,
          `Email: ${request.contactEmail || 'Not provided'}`,
          `Phone: ${request.contactPhone || 'Not provided'}`,
          `Added: ${new Date().toISOString()}`
        ].join('\n')

        // Store in AdditionalInformation field (IntakeQ public API supported)
        updates.AdditionalInformation = primaryClient.AdditionalInformation
          ? `${primaryClient.AdditionalInformation}\n\n${contactInfo}`
          : contactInfo

        console.log('📝 Storing contact in AdditionalInformation field (API limitation)')
      }

      // Apply updates if needed
      if (Object.keys(updates).length > 0) {
        await updateClient(primaryClient.Id, updates)

        // V2.0: Verify DOB was saved if we updated it (retry once if missing)
        if (updates.DateOfBirth && normalizedDob) {
          console.log(`🔍 Verifying DOB update for client ${primaryClient.Id}...`)
          try {
            const verifyResponse = await intakeQService.makeRequest<IntakeQClientSearchResult>(
              `/clients/${primaryClient.Id}`,
              { method: 'GET' }
            )

            if (!verifyResponse.DateOfBirth) {
              console.warn(`⚠️ IntakeQ response missing DOB after update, retrying...`)

              // IntakeQ requires the full client object for updates
              // First fetch the complete client data
              const fullClient = await intakeQService.makeRequest<IntakeQClientSearchResult>(
                `/clients/${primaryClient.Id}`,
                { method: 'GET' }
              )

              // Now update with the complete object including DOB
              await intakeQService.makeRequest('/clients', {
                method: 'PUT',
                body: JSON.stringify({
                  ...fullClient,
                  Id: primaryClient.Id,
                  DateOfBirth: normalizedDob
                })
              })
              console.log(`✅ DOB retry successful`)
            }
          } catch (retryError) {
            console.error(`❌ DOB verification/retry failed:`, retryError)
            errors.push('DOB may not have been saved to IntakeQ')
          }
        }
      }

      // Add pinned note if contact was provided
      if (request.contactName && request.contactEmail) {
        await createPinnedNote(
          primaryClient.Id,
          `Case manager/contact designated at booking:\n` +
          `Name: ${request.contactName}\n` +
          `Email: ${request.contactEmail}\n` +
          `Phone: ${request.contactPhone || 'Not provided'}\n` +
          `Mirrored all appointment communications via Moonlit mailer.`
        )
      }

      // Check for possible duplicates
      const isDuplicate = existingClients.length > 1
      if (isDuplicate && featureFlags.practiceqDuplicateAlerts) {
        // Send duplicate alert email
        await sendEmail({
          to: 'miriam@trymoonlit.com',
          subject: 'Possible Duplicate IntakeQ Client Detected',
          html: `
            <p>A booking was made that matches multiple existing IntakeQ clients:</p>
            <p><strong>Patient:</strong> ${request.firstName} ${request.lastName}</p>
            <p><strong>DOB:</strong> ${normalizedDob || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${normalizedPhone || 'Not provided'}</p>
            <p><strong>Existing Clients:</strong></p>
            <ul>
              ${existingClients.map(c =>
                `<li>ID: ${c.Id} - ${c.FirstName} ${c.LastName} (${c.Email})</li>`
              ).join('')}
            </ul>
            <p>Please review in IntakeQ to merge if needed.</p>
          `
        })
      }

      // Log to audit trail
      await logIntakeqSync({
        action: 'update_client',
        status: isDuplicate ? 'duplicate_detected' : 'success',
        patientId: request.patientId || null,
        appointmentId: request.appointmentId || null,
        intakeqClientId: primaryClient.Id,
        payload: {
          ...request,
          _aliasApplied: emailSelection.aliasApplied,
          _aliasReason: emailSelection.aliasReason
        },
        response: { updates, existingData: primaryClient },
        duplicateInfo: isDuplicate ? { clientIds: existingClients.map(c => c.Id) } : null,
        enrichmentData: {
          enrichedFields,
          insuranceCompanyName,
          emailAliasing: {
            aliasApplied: emailSelection.aliasApplied,
            aliasReason: emailSelection.aliasReason
          },
          identityMatch: request.identityMatch || 'strong' // Existing client reuse = strong match
        },
        durationMs: Date.now() - startTime
      })

      return {
        intakeqClientId: primaryClient.Id,
        isNewClient: false,
        isDuplicate,
        duplicateClients: isDuplicate ? existingClients.map(c => ({
          id: c.Id,
          name: `${c.FirstName} ${c.LastName}`,
          dob: c.DateOfBirth,
          email: c.Email
        })) : undefined,
        enrichedFields,
        errors
      }
    }

    // Handle fallback matches (DOB+phone or DOB+memberId) - create new client
    if (fallbackMatches.length > 0) {
      console.log(`⚠️ Found fallback matches (DOB+phone/memberId) - creating new client anyway`)

      // Send FYI email to Miriam about potential duplicates
      await sendEmail({
        to: 'miriam@trymoonlit.com',
        subject: 'FYI: Possible Duplicate IntakeQ Client (Fallback Match)',
        html: `
          <p>A booking created a new IntakeQ client despite finding possible matches:</p>
          <p><strong>New Patient:</strong> ${request.firstName} ${request.lastName}</p>
          <p><strong>DOB:</strong> ${normalizedDob || 'Not provided'}</p>
          <p><strong>Phone:</strong> ${normalizedPhone || 'Not provided'}</p>
          <p><strong>Email:</strong> ${request.email}</p>
          <p><strong>Match Type:</strong> Fallback (DOB+phone or DOB+memberId)</p>
          <p><strong>Possible Existing Clients:</strong></p>
          <ul>
            ${fallbackMatches.map(c =>
              `<li>ID: ${c.Id} - ${c.FirstName} ${c.LastName} (${c.Email})</li>`
            ).join('')}
          </ul>
          <p><strong>Action Taken:</strong> Created new client as per V2.0 rules (fallback matches don't update)</p>
          <p>Review both records in IntakeQ if consolidation is needed.</p>
        `
      })
    }

    // No strong match found - create new one
    console.log('🆕 Creating new IntakeQ client...')

    const newClientData: any = {
      FirstName: request.firstName,
      LastName: request.lastName,
      Email: emailSelection.intakeqEmail // Use selected email (canonical or alias)
    }

    // Add enriched fields (don't send empty strings - omit if missing)
    if (normalizedPhone) newClientData.Phone = normalizedPhone
    if (normalizedDob) newClientData.DateOfBirth = normalizedDob
    // Use correct IntakeQ field names for insurance
    if (insuranceCompanyName) newClientData.PrimaryInsuranceCompany = insuranceCompanyName
    if (normalizedMemberId) newClientData.PrimaryInsurancePolicyNumber = normalizedMemberId
    if (request.groupNumber) newClientData.PrimaryInsuranceGroupNumber = request.groupNumber

    console.log('🔍 [INSURANCE DEBUG] Insurance fields in client data:', {
      hasInsuranceCompany: !!insuranceCompanyName,
      insuranceCompany: insuranceCompanyName,
      hasPolicyNumber: !!normalizedMemberId,
      policyNumber: normalizedMemberId,
      originalMemberId: request.memberId,
      hasGroupNumber: !!request.groupNumber,
      groupNumber: request.groupNumber
    })

    // Add contact info to Additional Information (public API limitation)
    if (request.contactName) {
      const contactInfo = [
        `Case Manager/Contact:`,
        `Name: ${request.contactName}`,
        `Email: ${request.contactEmail || 'Not provided'}`,
        `Phone: ${request.contactPhone || 'Not provided'}`,
        `Added: ${new Date().toISOString()}`
      ]

      // Also add original phone formats if different
      if (request.phone && normalizedPhone !== request.phone) {
        contactInfo.push(`Patient phone (original): ${request.phone}`)
      }

      newClientData.AdditionalInformation = contactInfo.join('\n')
      console.log('📝 Storing contact in AdditionalInformation field (API limitation)')
    }

    // Log the exact data being sent to IntakeQ
    console.log('🔍 [INTAKEQ DEBUG] Creating client with data:', JSON.stringify(newClientData, null, 2))
    console.log('🔍 [INTAKEQ DEBUG] Specifically DOB:', {
      normalizedDob,
      originalDob: request.dateOfBirth,
      inPayload: newClientData.DateOfBirth
    })

    // Create the client
    const clientResponse = await intakeQService.createClient(newClientData)
    const intakeqClientId = clientResponse.Id

    console.log(`✅ Created new IntakeQ client: ${intakeqClientId}`)
    console.log('🔍 [INTAKEQ DEBUG] Client creation response:', JSON.stringify(clientResponse, null, 2))

    // V2.0: Verify DOB was saved (retry once if missing)
    if (normalizedDob && !clientResponse.DateOfBirth) {
      console.warn(`⚠️ IntakeQ response missing DOB, retrying with targeted update...`)
      try {
        // Fetch the full client first to preserve all fields
        const fullClient = await intakeQService.makeRequest<IntakeQClientSearchResult>(
          `/clients/${intakeqClientId}`,
          { method: 'GET' }
        )

        // Update with complete object including DOB
        await intakeQService.makeRequest('/clients', {
          method: 'PUT',
          body: JSON.stringify({
            ...fullClient,
            Id: intakeqClientId,
            DateOfBirth: normalizedDob
          })
        })
        console.log(`✅ DOB retry successful`)
      } catch (retryError) {
        console.error(`❌ DOB retry failed:`, retryError)
        errors.push('DOB may not have been saved to IntakeQ')
      }
    }

    // Add pinned note if contact was provided
    if (request.contactName && request.contactEmail) {
      await createPinnedNote(
        intakeqClientId,
        `Case manager/contact designated at booking:\n` +
        `Name: ${request.contactName}\n` +
        `Email: ${request.contactEmail}\n` +
        `Phone: ${request.contactPhone || 'Not provided'}\n` +
        `Mirrored all appointment communications via Moonlit mailer.`
      )
    }

    // Log to audit trail with identity match info
    const identityMatchReason = emailSelection.aliasApplied
      ? 'no_strong_match_email_collision'
      : (request.identityMatch || 'none')

    await logIntakeqSync({
      action: 'create_client',
      status: 'success',
      patientId: request.patientId || null,
      appointmentId: request.appointmentId || null,
      intakeqClientId,
      payload: {
        ...newClientData,
        _aliasApplied: emailSelection.aliasApplied,
        _aliasReason: emailSelection.aliasReason,
        _canonicalEmail: request.email // Redacted by logIntakeqSync
      },
      response: clientResponse,
      enrichmentData: {
        enrichedFields,
        insuranceCompanyName,
        emailAliasing: {
          aliasApplied: emailSelection.aliasApplied,
          aliasReason: emailSelection.aliasReason
        },
        identityMatch: identityMatchReason
      },
      durationMs: Date.now() - startTime
    })

    // Update our patients table if patientId provided
    if (request.patientId) {
      const patientUpdates: any = { intakeq_client_id: intakeqClientId }
      if (normalizedPhone) patientUpdates.phone = normalizedPhone
      if (normalizedDob) patientUpdates.date_of_birth = normalizedDob

      // Store the alias if one was used
      if (emailSelection.aliasApplied && !existingAlias) {
        patientUpdates.intakeq_email_alias = emailSelection.intakeqEmail
        console.log(`💾 Storing IntakeQ email alias in patients table`)
      }

      await supabaseAdmin
        .from('patients')
        .update(patientUpdates)
        .eq('id', request.patientId)
    }

    return {
      intakeqClientId,
      isNewClient: true,
      isDuplicate: false,
      enrichedFields,
      errors
    }

  } catch (error: any) {
    console.error('❌ Error in upsertPracticeQClient:', error)

    // Log failure to audit trail
    await logIntakeqSync({
      action: 'create_client',
      status: 'failed',
      patientId: request.patientId || null,
      appointmentId: request.appointmentId || null,
      error: error.message,
      payload: request,
      durationMs: Date.now() - startTime
    })

    throw error
  }
}
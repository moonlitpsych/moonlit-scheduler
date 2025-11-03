import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { normalizeIntakeqClientId, isValidIntakeqClientId } from './utils'
import { enrichClientData, type EnrichedClientData } from '@/lib/services/intakeqEnrichment'
import { logIntakeqSync } from '@/lib/services/intakeqAudit'
import { featureFlags } from '@/lib/config/featureFlags'
import { upsertPracticeQClient } from '@/lib/services/intakeqClientUpsert'

export interface IntakeQAppointmentRequest {
    intakeqClientId: string
    practitionerExternalId: string
    serviceExternalId: string
    start: Date
    end: Date
    locationType: 'telehealth' | 'in_person'
    notes?: string
}

export interface IntakeQAppointmentResponse {
    pqAppointmentId: string
}

export interface PolicySnapshot {
    payer_id: string
    payer_name: string
    member_id: string
    group_number?: string
    policy_holder_name?: string
    policy_holder_dob?: string
    effective_date?: string
    termination_date?: string
}

/**
 * Ensures a patient has an IntakeQ client ID, creating one if missing
 * V2.0: Supports enrichment when payerId is provided
 * V2.0.1: Supports identity matching metadata for audit logging
 * V2.1: Supports member ID and group number for insurance enrichment
 */
export async function ensureClient(
    patientId: string,
    payerId?: string | null,
    identityMatch?: 'strong' | 'fallback' | 'none',
    memberId?: string | null,
    groupNumber?: string | null
): Promise<string> {
    const startTime = Date.now()
    try {
        // First check if patient already has an IntakeQ client ID
        const { data: patient, error: fetchError } = await supabaseAdmin
            .from('patients')
            .select('intakeq_client_id, first_name, last_name, email, phone, date_of_birth')
            .eq('id', patientId)
            .single()

        if (fetchError) {
            console.error('❌ Error fetching patient:', fetchError)
            throw new Error(`Failed to fetch patient: ${fetchError.message}`)
        }

        if (!patient) {
            throw new Error(`Patient not found: ${patientId}`)
        }

        // If patient already has IntakeQ client ID, normalize and return it
        if (patient.intakeq_client_id) {
            // Use proper normalization to handle malformed formats: {"Id":"98"}, '{"Id":"98"}', "98"
            const clientId = normalizeIntakeqClientId(patient.intakeq_client_id)

            // Validate it's in correct format (numeric string)
            if (clientId && isValidIntakeqClientId(clientId)) {
                console.log(`✅ Patient ${patientId} already has IntakeQ client ID: ${clientId} (normalized from ${typeof patient.intakeq_client_id})`)
                return clientId
            } else {
                console.warn(`⚠️ Patient ${patientId} has malformed IntakeQ client ID: ${JSON.stringify(patient.intakeq_client_id)}, normalized to: "${clientId}" - will recreate`)
                // Fall through to create new client
            }
        }

        // V2.0: Use upsertPracticeQClient which handles email aliasing and enrichment
        console.log(`🔄 Creating/updating IntakeQ client for patient ${patientId}...`)

        // Log enrichment data being passed
        console.log('[INTAKEQ ENRICHMENT]', {
            hasPhone: !!patient.phone,
            hasDOB: !!patient.date_of_birth,
            hasPayerId: !!payerId,
            hasMemberId: !!memberId,
            hasGroupNumber: !!groupNumber
        })

        const upsertResult = await upsertPracticeQClient({
            firstName: patient.first_name || '',
            lastName: patient.last_name || '',
            email: patient.email || '',
            phone: patient.phone || null,
            dateOfBirth: patient.date_of_birth || null,
            payerId: payerId || null,
            memberId: memberId || null,
            groupNumber: groupNumber || null,
            patientId: patientId,
            identityMatch: identityMatch || 'none'
        })

        const intakeqClientId = upsertResult.intakeqClientId

        console.log(`✅ IntakeQ client upsert complete: ${intakeqClientId}`, {
            isNew: upsertResult.isNewClient,
            isDuplicate: upsertResult.isDuplicate,
            enrichedFields: upsertResult.enrichedFields
        })

        // ✅ FIX: Add delay to ensure IntakeQ has propagated the client
        // IntakeQ needs time before the client is available for appointments
        // V3.2: Enhanced verification with exponential backoff
        // IntakeQ's eventual consistency can take 10-30 seconds in edge cases
        console.log('⏳ Waiting 5000ms for IntakeQ client propagation...')
        await new Promise(resolve => setTimeout(resolve, 5000))

        // V3.2: Verify client is queryable with up to 4 attempts
        // Exponential backoff: 3s, 6s, 12s, 24s (total 45s additional wait if all fail)
        const maxVerificationAttempts = 4
        const backoffMultiplier = 3000 // Base delay in ms
        let verificationSuccessful = false
        let lastError: any = null

        console.log(`🔍 Verifying IntakeQ client ${intakeqClientId} is queryable...`)

        for (let attempt = 1; attempt <= maxVerificationAttempts; attempt++) {
            try {
                await intakeQService.makeRequest(`/clients/${intakeqClientId}`, { method: 'GET' })
                console.log(`✅ Client verification successful on attempt ${attempt}`)
                verificationSuccessful = true
                break
            } catch (error: any) {
                lastError = error
                if (attempt < maxVerificationAttempts) {
                    const delay = backoffMultiplier * Math.pow(2, attempt - 1)
                    console.warn(`⚠️ Client verification attempt ${attempt} failed, waiting ${delay}ms: ${error.message}`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                } else {
                    console.error(`❌ Client verification failed after ${maxVerificationAttempts} attempts: ${error.message}`)
                }
            }
        }

        if (!verificationSuccessful) {
            // Total time waited: 5s initial + 3s + 6s + 12s + 24s = 50 seconds
            throw new Error(`Client created but not available in IntakeQ after ${maxVerificationAttempts} attempts: ${lastError?.message}`)
        }

        // Update our database with the IntakeQ client ID (upsertPracticeQClient already handles alias storage)
        const updateData: any = { intakeq_client_id: intakeqClientId }

        const { error: updateError } = await supabaseAdmin
            .from('patients')
            .update(updateData)
            .eq('id', patientId)

        if (updateError) {
            console.error('❌ Error persisting IntakeQ client ID:', updateError)
            throw new Error(`Failed to persist IntakeQ client ID: ${updateError.message}`)
        }

        console.log(`✅ Persisted IntakeQ client ID for patient ${patientId}: ${intakeqClientId}`)

        // V3.2: Ensure we never return an empty client ID
        if (!intakeqClientId || intakeqClientId.trim() === '') {
            throw new Error('IntakeQ client ID is empty after creation - this should never happen')
        }

        return intakeqClientId

    } catch (error: any) {
        console.error(`❌ Error ensuring IntakeQ client for patient ${patientId}:`, error)

        // V2.0: Log failed client creation to audit trail
        const duration = Date.now() - startTime
        await logIntakeqSync({
            action: 'create_client',
            status: 'failed',
            patientId,
            error: error.message,
            durationMs: duration
        })

        throw error
    }
}

/**
 * Updates IntakeQ client insurance information
 */
export async function syncClientInsurance(intakeqClientId: string, policySnapshot: PolicySnapshot): Promise<void> {
    try {
        console.log(`🔄 Syncing insurance for IntakeQ client ${intakeqClientId}...`)

        const insuranceData = {
            PrimaryInsuranceName: policySnapshot.payer_name,
            PrimaryMemberID: policySnapshot.member_id,
            PrimaryGroupNumber: policySnapshot.group_number || '',
            PrimaryPolicyHolderName: policySnapshot.policy_holder_name || '',
            PrimaryPolicyHolderDOB: policySnapshot.policy_holder_dob || ''
        }

        await intakeQService.updateClientInsurance(intakeqClientId, insuranceData)
        console.log(`✅ Synced insurance for IntakeQ client ${intakeqClientId}`)

    } catch (error: any) {
        console.error(`❌ Error syncing insurance for IntakeQ client ${intakeqClientId}:`, error)
        throw error
    }
}

/**
 * Creates an appointment in IntakeQ with retry logic
 * V3.0: Increased retries from 3 to 4 and longer delays for better reliability
 */
export async function createAppointment(request: IntakeQAppointmentRequest): Promise<IntakeQAppointmentResponse> {
    const maxRetries = 4 // V3.0: Increased from 3 to 4
    let lastError: any

    // Default location ID for telehealth (from CLAUDE.md: "4" for Insurance - UT)
    const INTAKEQ_LOCATION_ID = '4'

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Creating IntakeQ appointment (attempt ${attempt}/${maxRetries})...`)

            const pqAppointmentId = await intakeQService.createAppointmentWithClient({
                clientId: request.intakeqClientId,
                practitionerId: request.practitionerExternalId,
                serviceId: request.serviceExternalId,
                locationId: INTAKEQ_LOCATION_ID,
                dateTime: request.start,
                status: 'Confirmed',
                sendEmailNotification: true
            })

            if (!pqAppointmentId) {
                throw new Error('Failed to create IntakeQ appointment - no appointment ID returned')
            }

            console.log(`✅ Created IntakeQ appointment: ${pqAppointmentId}`)
            return { pqAppointmentId }

        } catch (error: any) {
            lastError = error
            console.error(`❌ IntakeQ appointment creation attempt ${attempt} failed:`, error)

            // Check if this is a retryable error:
            // - 429 rate limit
            // - 5xx server error
            // - 400 "Client not found" (race condition with client creation)
            const isClientNotFound = error.status === 400 && error.message?.includes('Client not found')
            const isRetryable = error.status === 429 ||
                               (error.status >= 500 && error.status < 600) ||
                               isClientNotFound

            if (!isRetryable || attempt === maxRetries) {
                break
            }

            // V3.0: Increased exponential backoff for IntakeQ propagation
            // Old: 2s, 4s, 8s = 14s total
            // New: 3s, 6s, 12s, 24s = 45s total (gives IntakeQ more time)
            const delayMs = Math.pow(2, attempt) * 1500 // V3.0: Changed from 1000ms to 1500ms base
            console.log(`⏳ Retrying in ${delayMs}ms...${isClientNotFound ? ' (waiting for IntakeQ client propagation)' : ''}`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    // All retries failed
    console.error(`❌ All IntakeQ appointment creation attempts failed. Last error:`, lastError)
    throw lastError || new Error('IntakeQ appointment creation failed after all retries')
}
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { normalizeIntakeqClientId, isValidIntakeqClientId } from './utils'
import { enrichClientData, type EnrichedClientData } from '@/lib/services/intakeqEnrichment'
import { logIntakeqSync } from '@/lib/services/intakeqAudit'
import { featureFlags } from '@/lib/config/featureFlags'

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
 */
export async function ensureClient(patientId: string, payerId?: string | null): Promise<string> {
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

        // Create new IntakeQ client
        console.log(`🔄 Creating new IntakeQ client for patient ${patientId}...`)

        // V2.0: Apply enrichment if enabled and payerId provided
        let clientData: EnrichedClientData
        let enrichmentResult: any = null

        if (featureFlags.practiceqEnrich && payerId) {
            console.log('🔄 V2.0: Applying enrichment to client data...')
            enrichmentResult = await enrichClientData(patientId, payerId, {
                FirstName: patient.first_name || '',
                LastName: patient.last_name || '',
                Email: patient.email || '',
                Phone: patient.phone || null,
                DateOfBirth: patient.date_of_birth || null
            })
            clientData = enrichmentResult.enrichedData
            console.log(`✅ V2.0: Enrichment applied. Fields: ${enrichmentResult.enrichmentFields.join(', ')}`)

            // Log enrichment to audit trail
            await logIntakeqSync({
                action: 'enrichment_applied',
                status: 'success',
                patientId,
                enrichmentData: {
                    fields: enrichmentResult.enrichmentFields,
                    errors: enrichmentResult.errors
                }
            })
        } else {
            // No enrichment - use basic data
            clientData = {
                FirstName: patient.first_name || '',
                LastName: patient.last_name || '',
                Email: patient.email || '',
                Phone: patient.phone || '',
                DateOfBirth: patient.date_of_birth || null
            }
        }

        const clientResponse = await intakeQService.createClient(clientData)

        if (!clientResponse?.Id) {
            throw new Error('Failed to create IntakeQ client - no client ID returned')
        }

        // CRITICAL: Normalize the client ID from IntakeQ response
        // IntakeQ might return {Id: "98"}, {ClientId: 98}, or other formats
        const rawClientId = clientResponse.Id
        const intakeqClientId = normalizeIntakeqClientId(rawClientId)

        // Validate the normalized ID before saving to database
        if (!isValidIntakeqClientId(intakeqClientId)) {
            console.error(`❌ IntakeQ returned invalid client ID format:`, rawClientId)
            throw new Error(`Invalid client ID format from IntakeQ: ${JSON.stringify(rawClientId)}`)
        }

        console.log(`✅ Normalized new IntakeQ client ID: "${intakeqClientId}" (from ${typeof rawClientId}: ${JSON.stringify(rawClientId)})`)

        // ✅ FIX: Add delay to ensure IntakeQ has propagated the client
        // IntakeQ needs time before the client is available for appointments
        // Testing shows 500ms is insufficient - increasing to 2000ms
        console.log('⏳ Waiting 2000ms for IntakeQ client propagation...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Persist the NORMALIZED IntakeQ client ID to our database
        const { error: updateError } = await supabaseAdmin
            .from('patients')
            .update({ intakeq_client_id: intakeqClientId })
            .eq('id', patientId)

        if (updateError) {
            console.error('❌ Error persisting IntakeQ client ID:', updateError)
            throw new Error(`Failed to persist IntakeQ client ID: ${updateError.message}`)
        }

        console.log(`✅ Created and persisted IntakeQ client ID for patient ${patientId}: ${intakeqClientId}`)

        // V2.0: Log successful client creation to audit trail
        const duration = Date.now() - startTime
        await logIntakeqSync({
            action: 'create_client',
            status: 'success',
            patientId,
            intakeqClientId,
            payload: clientData,
            response: clientResponse,
            durationMs: duration
        })

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
 */
export async function createAppointment(request: IntakeQAppointmentRequest): Promise<IntakeQAppointmentResponse> {
    const maxRetries = 3
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

            // Exponential backoff: 2s, 4s, 8s (longer delays for IntakeQ propagation)
            const delayMs = Math.pow(2, attempt) * 1000
            console.log(`⏳ Retrying in ${delayMs}ms...${isClientNotFound ? ' (waiting for IntakeQ client propagation)' : ''}`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    // All retries failed
    console.error(`❌ All IntakeQ appointment creation attempts failed. Last error:`, lastError)
    throw lastError || new Error('IntakeQ appointment creation failed after all retries')
}
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'

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
 */
export async function ensureClient(patientId: string): Promise<string> {
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

        // If patient already has IntakeQ client ID, return it
        if (patient.intakeq_client_id) {
            console.log(`✅ Patient ${patientId} already has IntakeQ client ID: ${patient.intakeq_client_id}`)
            return patient.intakeq_client_id
        }

        // Create new IntakeQ client
        console.log(`🔄 Creating new IntakeQ client for patient ${patientId}...`)

        const clientData = {
            FirstName: patient.first_name || '',
            LastName: patient.last_name || '',
            Email: patient.email || '',
            CellPhone: patient.phone || '',
            DateOfBirth: patient.date_of_birth || null
        }

        const intakeqClientId = await intakeQService.createClient(clientData)

        if (!intakeqClientId) {
            throw new Error('Failed to create IntakeQ client - no client ID returned')
        }

        // Persist the IntakeQ client ID to our database
        const { error: updateError } = await supabaseAdmin
            .from('patients')
            .update({ intakeq_client_id: intakeqClientId })
            .eq('id', patientId)

        if (updateError) {
            console.error('❌ Error persisting IntakeQ client ID:', updateError)
            throw new Error(`Failed to persist IntakeQ client ID: ${updateError.message}`)
        }

        console.log(`✅ Created and persisted IntakeQ client ID for patient ${patientId}: ${intakeqClientId}`)
        return intakeqClientId

    } catch (error: any) {
        console.error(`❌ Error ensuring IntakeQ client for patient ${patientId}:`, error)
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

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Creating IntakeQ appointment (attempt ${attempt}/${maxRetries})...`)

            const appointmentData = {
                ClientId: request.intakeqClientId,
                PractitionerId: request.practitionerExternalId,
                ServiceId: request.serviceExternalId,
                StartDate: request.start.toISOString(),
                EndDate: request.end.toISOString(),
                LocationType: request.locationType === 'telehealth' ? 'Virtual' : 'In Person',
                Notes: request.notes || '',
                Status: 'Scheduled'
            }

            const pqAppointmentId = await intakeQService.createAppointment(appointmentData)

            if (!pqAppointmentId) {
                throw new Error('Failed to create IntakeQ appointment - no appointment ID returned')
            }

            console.log(`✅ Created IntakeQ appointment: ${pqAppointmentId}`)
            return { pqAppointmentId }

        } catch (error: any) {
            lastError = error
            console.error(`❌ IntakeQ appointment creation attempt ${attempt} failed:`, error)

            // Check if this is a retryable error (429 rate limit, 5xx server error)
            const isRetryable = error.status === 429 || (error.status >= 500 && error.status < 600)

            if (!isRetryable || attempt === maxRetries) {
                break
            }

            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, attempt - 1) * 1000
            console.log(`⏳ Retrying in ${delayMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    // All retries failed
    console.error(`❌ All IntakeQ appointment creation attempts failed. Last error:`, lastError)
    throw lastError || new Error('IntakeQ appointment creation failed after all retries')
}
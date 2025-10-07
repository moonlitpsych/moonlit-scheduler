import { supabaseAdmin } from '@/lib/supabase'

interface IntakeServiceInstance {
    serviceInstanceId: string
    durationMinutes: number
}

/**
 * Validates if a string is a valid UUID format
 */
function isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
}

/**
 * Resolves the single Intake Telehealth service instance for a given payer.
 * Returns both service instance ID and duration from services.duration_minutes.
 *
 * @param payerId - The payer UUID to resolve the service instance for
 * @returns Promise<IntakeServiceInstance> - The service instance ID and duration
 * @throws Error with code 'INVALID_PAYER_ID' if payerId is not a valid UUID
 * @throws Error with code 'NO_INTAKE_INSTANCE_FOR_PAYER' if none found
 */
export async function resolveIntakeServiceInstance(payerId: string): Promise<IntakeServiceInstance> {
    try {
        console.log('📦 resolveIntake {payerId}', payerId)

        // Validate payerId is a UUID
        if (!isValidUUID(payerId)) {
            const invalidPayerError = new Error(`Invalid payer ID format: ${payerId}`)
            ;(invalidPayerError as any).status = 422
            ;(invalidPayerError as any).code = 'INVALID_PAYER_ID'
            ;(invalidPayerError as any).payerId = payerId
            throw invalidPayerError
        }

        // Schema-accurate query: service_instances + services + service_instance_integrations
        const { data, error } = await supabaseAdmin
            .from('service_instances')
            .select(`
                id,
                payer_id,
                location,
                pos_code,
                services!inner(
                    name,
                    duration_minutes
                ),
                service_instance_integrations!inner(
                    system,
                    external_id
                )
            `)
            .eq('active', true)
            .eq('location', 'Telehealth')
            .eq('pos_code', '10')
            .ilike('services.name', 'Intake%')
            .in('service_instance_integrations.system', ['intakeq', 'practiceq'])
            .or(`payer_id.eq.${payerId},payer_id.is.null`)

        console.log('📦 resolveIntake results', { count: data?.length || 0 })

        if (error) {
            console.error('❌ Error querying Intake service instances:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data || data.length === 0) {
            console.error(`❌ No Intake Telehealth service instance found for payer: ${payerId}`)
            const noInstanceError = new Error(`No Intake Telehealth service instance configured for payer ${payerId}`)
            ;(noInstanceError as any).status = 422
            ;(noInstanceError as any).code = 'NO_INTAKE_INSTANCE_FOR_PAYER'
            ;(noInstanceError as any).payerId = payerId
            ;(noInstanceError as any).debug = {
                queryReturned: data?.length || 0,
                errorDetails: error?.message || 'No query error'
            }
            throw noInstanceError
        }

        // Prioritize payer-specific instance over global
        const payerSpecific = data.filter(d => d.payer_id === payerId)
        const candidates = payerSpecific.length ? payerSpecific : data.filter(d => d.payer_id === null)

        if (candidates.length === 0) {
            console.error(`❌ No suitable Intake Telehealth service instance for payer: ${payerId}`)
            const noSuitableInstanceError = new Error(`No suitable Intake Telehealth service instance for payer ${payerId}`)
            ;(noSuitableInstanceError as any).status = 422
            ;(noSuitableInstanceError as any).code = 'NO_INTAKE_INSTANCE_FOR_PAYER'
            ;(noSuitableInstanceError as any).payerId = payerId
            throw noSuitableInstanceError
        }

        const selected = candidates[0]

        // Validate duration_minutes exists
        if (!selected.services?.duration_minutes) {
            const missingDurationError = new Error(`Intake service instance ${selected.id} has no duration configured`)
            ;(missingDurationError as any).status = 422
            ;(missingDurationError as any).code = 'MISSING_DURATION'
            ;(missingDurationError as any).serviceInstanceId = selected.id
            throw missingDurationError
        }

        console.log('📦 resolveIntake picked', { id: selected.id })

        return {
            serviceInstanceId: selected.id,
            durationMinutes: selected.services.duration_minutes
        }

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && error.code) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in resolveIntakeServiceInstance:', error)
        const wrappedError = new Error(`Failed to resolve Intake service instance: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Legacy wrapper - resolves service instance ID only
 * @deprecated Use resolveIntakeServiceInstance instead
 */
export async function getIntakeServiceInstanceForPayer(payerId: string): Promise<string> {
    const result = await resolveIntakeServiceInstance(payerId)
    return result.serviceInstanceId
}

/**
 * Legacy wrapper - resolves duration only
 * @deprecated Use resolveIntakeServiceInstance instead
 */
export async function getIntakeDurationForPayer(payerId: string): Promise<number> {
    const result = await resolveIntakeServiceInstance(payerId)
    return result.durationMinutes
}
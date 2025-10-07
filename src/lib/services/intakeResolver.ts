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
 * Uses staged approach to avoid brittle inner joins.
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

        // S1: Query base Intake service instances (filter by service name)
        const { data: s1AllData, error: s1Error } = await supabaseAdmin
            .from('service_instances')
            .select(`
                id,
                payer_id,
                services!inner(
                    name,
                    duration_minutes
                )
            `)

        if (s1Error) {
            console.error('❌ S1 query error:', s1Error)
            throw new Error(`Database error in S1: ${s1Error.message}`)
        }

        // Filter by service name in code (resilient to whitespace and variations)
        const s1Rows = (s1AllData || []).filter(r => {
            const name = (r.services?.name || '').toLowerCase()
            return name.includes('intake') || name.includes('new patient')
        })

        console.log(`📦 resolveIntake S1 base_intake: ${s1Rows.length} rows`)

        // S2: Filter for payer-specific OR global (null) in code
        const payerSpecific = s1Rows.filter(r => r.payer_id === payerId)
        const globalNull = s1Rows.filter(r => r.payer_id === null)
        const s2Rows = [...payerSpecific, ...globalNull]

        console.log(`📦 resolveIntake S2 payer_scoped: ${s2Rows.length} rows (${payerSpecific.length} payer-specific, ${globalNull.length} global-null)`)

        // S3: Query integrations separately, build mapped IDs set
        const { data: integrationsData, error: intError } = await supabaseAdmin
            .from('service_instance_integrations')
            .select('service_instance_id, system, external_id')
            .in('system', ['intakeq', 'practiceq'])
            .not('external_id', 'is', null)

        if (intError) {
            console.error('❌ S3 integrations query error:', intError)
            throw new Error(`Database error in S3: ${intError.message}`)
        }

        const mappedIds = new Set((integrationsData || []).map(i => i.service_instance_id))
        const s3Rows = s2Rows.filter(r => mappedIds.has(r.id))

        console.log(`📦 resolveIntake results { base: ${s1Rows.length}, payerScoped: ${s2Rows.length}, mapped: ${s3Rows.length} }`)

        // S4: Pick candidate (prefer payer-specific over global)
        if (s3Rows.length === 0) {
            console.error(`❌ No mapped Intake Telehealth service instance for payer: ${payerId}`)
            const noInstanceError = new Error(`No Intake Telehealth service instance configured for payer ${payerId}`)
            ;(noInstanceError as any).status = 422
            ;(noInstanceError as any).code = 'NO_INTAKE_INSTANCE_FOR_PAYER'
            ;(noInstanceError as any).payerId = payerId
            ;(noInstanceError as any).debug = {
                base_intake: s1Rows.length,
                payer_scoped: s2Rows.length,
                payer_specific: payerSpecific.length,
                global_null: globalNull.length,
                with_mapping: s3Rows.length
            }
            throw noInstanceError
        }

        const candidate = s3Rows.find(r => r.payer_id === payerId) || s3Rows[0]

        // Validate duration_minutes exists
        if (!candidate.services?.duration_minutes) {
            const missingDurationError = new Error(`Intake service instance ${candidate.id} has no duration configured`)
            ;(missingDurationError as any).status = 422
            ;(missingDurationError as any).code = 'MISSING_DURATION'
            ;(missingDurationError as any).serviceInstanceId = candidate.id
            throw missingDurationError
        }

        console.log(`📦 resolveIntake picked { id: ${candidate.id}, durationMinutes: ${candidate.services.duration_minutes} }`)

        return {
            serviceInstanceId: candidate.id,
            durationMinutes: candidate.services.duration_minutes
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
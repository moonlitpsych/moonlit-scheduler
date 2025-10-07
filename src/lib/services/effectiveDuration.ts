import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gets the effective duration in minutes for a service instance from the view.
 * Throws 422 error with code 'MISSING_DURATION' if duration is null/missing.
 */
export async function getEffectiveDurationMinutes(serviceInstanceId: string): Promise<number> {
    try {
        console.log(`🔍 Getting effective duration for service instance: ${serviceInstanceId}`)

        const { data, error } = await supabaseAdmin
            .from('v_service_instance_effective')
            .select('duration_minutes')
            .eq('id', serviceInstanceId)
            .single()

        if (error) {
            console.error('❌ Error fetching service instance duration:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data) {
            console.error(`❌ Service instance not found: ${serviceInstanceId}`)
            const notFoundError = new Error(`Service instance not found: ${serviceInstanceId}`)
            ;(notFoundError as any).status = 404
            throw notFoundError
        }

        if (data.duration_minutes === null || data.duration_minutes === undefined) {
            console.error(`❌ Missing duration for service instance: ${serviceInstanceId}`)
            const missingDurationError = new Error(`Service instance ${serviceInstanceId} has no configured duration`)
            ;(missingDurationError as any).status = 422
            ;(missingDurationError as any).code = 'MISSING_DURATION'
            throw missingDurationError
        }

        console.log(`✅ Got effective duration for ${serviceInstanceId}: ${data.duration_minutes} minutes`)
        return data.duration_minutes

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && (error.code || error.status !== 500)) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getEffectiveDurationMinutes:', error)
        const wrappedError = new Error(`Failed to get effective duration: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Validates that a service instance has an effective duration configured.
 * Returns the duration or throws a 422 error.
 */
export async function validateServiceInstanceDuration(serviceInstanceId: string): Promise<number> {
    return getEffectiveDurationMinutes(serviceInstanceId)
}
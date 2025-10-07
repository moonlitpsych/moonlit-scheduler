import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gets the effective duration in minutes for a service instance.
 * Reads from v_service_instance_effective.duration_minutes.
 *
 * @param serviceInstanceId - The service instance ID
 * @returns Promise<number> - Duration in minutes
 * @throws 422 error with code 'MISSING_DURATION' if duration is null/missing
 */
export async function getEffectiveDurationMinutes(serviceInstanceId: string): Promise<number> {
    try {
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
            throw new Error(`Service instance not found: ${serviceInstanceId}`)
        }

        if (data.duration_minutes === null || data.duration_minutes === undefined) {
            console.error(`❌ Missing duration for service instance: ${serviceInstanceId}`)
            const error = new Error('Missing duration for service instance')
            ;(error as any).status = 422
            ;(error as any).code = 'MISSING_DURATION'
            throw error
        }

        console.log(`✅ Got duration for ${serviceInstanceId}: ${data.duration_minutes} minutes`)
        return data.duration_minutes

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && error.code) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getEffectiveDurationMinutes:', error)
        const wrappedError = new Error(`Failed to get duration: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Gets effective durations for multiple service instances in batch.
 * More efficient than calling getEffectiveDurationMinutes multiple times.
 *
 * @param serviceInstanceIds - Array of service instance IDs
 * @returns Promise<Record<string, number>> - Map of service instance ID to duration
 */
export async function getEffectiveDurationMinutesBatch(serviceInstanceIds: string[]): Promise<Record<string, number>> {
    if (serviceInstanceIds.length === 0) {
        return {}
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('v_service_instance_effective')
            .select('id, duration_minutes')
            .in('id', serviceInstanceIds)

        if (error) {
            console.error('❌ Error fetching service instance durations (batch):', error)
            throw new Error(`Database error: ${error.message}`)
        }

        const durationMap: Record<string, number> = {}
        const missingDurations: string[] = []

        for (const row of data || []) {
            if (row.duration_minutes === null || row.duration_minutes === undefined) {
                missingDurations.push(row.id)
            } else {
                durationMap[row.id] = row.duration_minutes
            }
        }

        if (missingDurations.length > 0) {
            console.error(`❌ Missing durations for service instances: ${missingDurations.join(', ')}`)
            const error = new Error(`Missing durations for service instances: ${missingDurations.join(', ')}`)
            ;(error as any).status = 422
            ;(error as any).code = 'MISSING_DURATION'
            throw error
        }

        console.log(`✅ Got durations for ${Object.keys(durationMap).length} service instances`)
        return durationMap

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && error.code) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getEffectiveDurationMinutesBatch:', error)
        const wrappedError = new Error(`Failed to get durations: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}
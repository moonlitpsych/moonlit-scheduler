import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gets the IntakeQ service ID for a service instance.
 * Throws 422 error with code 'MISSING_SERVICE_MAPPING' if mapping is missing.
 */
export async function getIntakeqServiceId(serviceInstanceId: string): Promise<string> {
    try {
        console.log(`🔍 Getting IntakeQ service ID for service instance: ${serviceInstanceId}`)

        const { data, error } = await supabaseAdmin
            .from('service_instance_integrations')
            .select('external_id, system')  // Removed go_live_date - column doesn't exist in schema
            .eq('service_instance_id', serviceInstanceId)
            .in('system', ['intakeq', 'practiceq'])
            .single()

        if (error) {
            // Check if it's a "no rows" error vs a real database error
            if (error.code === 'PGRST116') {
                console.error(`❌ No IntakeQ/PracticeQ mapping found for service instance: ${serviceInstanceId}`)
                const missingMappingError = new Error(
                    `Service instance ${serviceInstanceId} has no IntakeQ/PracticeQ mapping configured`
                )
                ;(missingMappingError as any).status = 422
                ;(missingMappingError as any).code = 'MISSING_SERVICE_MAPPING'
                throw missingMappingError
            }

            console.error('❌ Error fetching service instance mapping:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data) {
            console.error(`❌ No IntakeQ/PracticeQ mapping found for service instance: ${serviceInstanceId}`)
            const missingMappingError = new Error(
                `Service instance ${serviceInstanceId} has no IntakeQ/PracticeQ mapping configured`
            )
            ;(missingMappingError as any).status = 422
            ;(missingMappingError as any).code = 'MISSING_SERVICE_MAPPING'
            throw missingMappingError
        }

        // Skip go_live_date check - column doesn't exist in current schema
        // If needed in future, add migration to create the column first

        if (!data.external_id) {
            console.error(`❌ Missing external_id in mapping for service instance: ${serviceInstanceId}`)
            const missingExternalIdError = new Error(
                `Service instance ${serviceInstanceId} mapping has no external_id configured`
            )
            ;(missingExternalIdError as any).status = 422
            ;(missingExternalIdError as any).code = 'MISSING_SERVICE_MAPPING'
            throw missingExternalIdError
        }

        console.log(`✅ Got ${data.system} service ID for service instance ${serviceInstanceId}: ${data.external_id}`)
        return data.external_id

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && (error.code || error.status !== 500)) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getIntakeqServiceId:', error)
        const wrappedError = new Error(`Failed to get IntakeQ service mapping: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Validates that a service instance has an IntakeQ service mapping configured.
 * Returns the service ID or throws a 422 error.
 */
export async function validateServiceInstanceMapping(serviceInstanceId: string): Promise<string> {
    return getIntakeqServiceId(serviceInstanceId)
}

/**
 * Batch lookup for multiple service instances
 */
export async function getIntakeqServiceIdsBatch(serviceInstanceIds: string[]): Promise<Record<string, string>> {
    if (serviceInstanceIds.length === 0) {
        return {}
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('service_instance_integrations')
            .select('service_instance_id, external_id, system')  // Removed go_live_date - column doesn't exist
            .in('service_instance_id', serviceInstanceIds)
            .in('system', ['intakeq', 'practiceq'])

        if (error) {
            console.error('❌ Error fetching service instance mappings (batch):', error)
            throw new Error(`Database error: ${error.message}`)
        }

        const mappings: Record<string, string> = {}
        const missingMappings: string[] = []

        for (const serviceInstanceId of serviceInstanceIds) {
            const mapping = data?.find(row => row.service_instance_id === serviceInstanceId)

            if (!mapping || !mapping.external_id) {
                missingMappings.push(serviceInstanceId)
                continue
            }

            // Skip go_live_date check - column doesn't exist in current schema
            mappings[serviceInstanceId] = mapping.external_id
        }

        if (missingMappings.length > 0) {
            const missingMappingError = new Error(
                `Service instances missing IntakeQ/PracticeQ mappings: ${missingMappings.join(', ')}`
            )
            ;(missingMappingError as any).status = 422
            ;(missingMappingError as any).code = 'MISSING_SERVICE_MAPPING'
            throw missingMappingError
        }

        console.log(`✅ Got IntakeQ/PracticeQ service IDs for ${Object.keys(mappings).length} service instances`)
        return mappings

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && error.code) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getIntakeqServiceIdsBatch:', error)
        const wrappedError = new Error(`Failed to get IntakeQ service mappings: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Checks if a service instance has a live IntakeQ/PracticeQ mapping
 */
export async function hasLiveMapping(serviceInstanceId: string): Promise<boolean> {
    try {
        await getIntakeqServiceId(serviceInstanceId)
        return true
    } catch (error: any) {
        if (error.code === 'MISSING_SERVICE_MAPPING' || error.code === 'MAPPING_NOT_LIVE') {
            return false
        }
        throw error // Re-throw unexpected errors
    }
}

/**
 * REVERSE LOOKUP: Gets a service_instance_id from an IntakeQ/PracticeQ external service ID.
 * Used by sync service to correctly classify appointments from IntakeQ.
 *
 * Returns the first matching service_instance_id, or null if no mapping exists.
 * Note: Multiple service instances may map to the same external_id (different payers/providers),
 * so this returns ONE valid instance for that service type.
 */
export async function getServiceInstanceIdFromIntakeq(
    intakeqServiceId: string,
    defaultServiceInstanceId?: string
): Promise<string | null> {
    try {
        console.log(`🔍 Looking up service_instance_id for IntakeQ service: ${intakeqServiceId}`)

        const { data, error } = await supabaseAdmin
            .from('service_instance_integrations')
            .select('service_instance_id')
            .eq('external_id', intakeqServiceId)
            .in('system', ['intakeq', 'practiceq'])
            .limit(1)

        if (error) {
            console.error('❌ Error looking up service instance from IntakeQ ID:', error)
            return defaultServiceInstanceId || null
        }

        if (!data || data.length === 0) {
            console.warn(`⚠️ No service instance found for IntakeQ service ID: ${intakeqServiceId}`)
            return defaultServiceInstanceId || null
        }

        console.log(`✅ Found service_instance_id ${data[0].service_instance_id} for IntakeQ service ${intakeqServiceId}`)
        return data[0].service_instance_id

    } catch (error: any) {
        console.error('❌ Unexpected error in getServiceInstanceIdFromIntakeq:', error)
        return defaultServiceInstanceId || null
    }
}
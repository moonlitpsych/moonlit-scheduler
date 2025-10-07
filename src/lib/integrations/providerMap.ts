import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gets the IntakeQ practitioner ID for a provider.
 * Throws 422 error with code 'MISSING_PROVIDER_MAPPING' if mapping is missing.
 */
export async function getIntakeqPractitionerId(providerId: string): Promise<string> {
    try {
        console.log(`🔍 Getting IntakeQ practitioner ID for provider: ${providerId}`)

        const { data, error } = await supabaseAdmin
            .from('providers')
            .select('intakeq_practitioner_id, first_name, last_name')
            .eq('id', providerId)
            .single()

        if (error) {
            console.error('❌ Error fetching provider:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data) {
            console.error(`❌ Provider not found: ${providerId}`)
            const notFoundError = new Error(`Provider not found: ${providerId}`)
            ;(notFoundError as any).status = 404
            throw notFoundError
        }

        if (!data.intakeq_practitioner_id) {
            console.error(`❌ Missing IntakeQ practitioner mapping for provider: ${providerId} (${data.first_name} ${data.last_name})`)
            const missingMappingError = new Error(
                `Provider ${data.first_name} ${data.last_name} (${providerId}) has no IntakeQ practitioner mapping configured`
            )
            ;(missingMappingError as any).status = 422
            ;(missingMappingError as any).code = 'MISSING_PROVIDER_MAPPING'
            throw missingMappingError
        }

        console.log(`✅ Got IntakeQ practitioner ID for ${data.first_name} ${data.last_name}: ${data.intakeq_practitioner_id}`)
        return data.intakeq_practitioner_id

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && (error.code || error.status !== 500)) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getIntakeqPractitionerId:', error)
        const wrappedError = new Error(`Failed to get IntakeQ practitioner mapping: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}

/**
 * Validates that a provider has an IntakeQ practitioner mapping configured.
 * Returns the practitioner ID or throws a 422 error.
 */
export async function validateProviderMapping(providerId: string): Promise<string> {
    return getIntakeqPractitionerId(providerId)
}

/**
 * Batch lookup for multiple providers
 */
export async function getIntakeqPractitionerIdsBatch(providerIds: string[]): Promise<Record<string, string>> {
    if (providerIds.length === 0) {
        return {}
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('providers')
            .select('id, intakeq_practitioner_id, first_name, last_name')
            .in('id', providerIds)

        if (error) {
            console.error('❌ Error fetching providers (batch):', error)
            throw new Error(`Database error: ${error.message}`)
        }

        const mappings: Record<string, string> = {}
        const missingMappings: string[] = []

        for (const provider of data || []) {
            if (provider.intakeq_practitioner_id) {
                mappings[provider.id] = provider.intakeq_practitioner_id
            } else {
                missingMappings.push(`${provider.first_name} ${provider.last_name} (${provider.id})`)
            }
        }

        if (missingMappings.length > 0) {
            const missingMappingError = new Error(
                `Providers missing IntakeQ practitioner mappings: ${missingMappings.join(', ')}`
            )
            ;(missingMappingError as any).status = 422
            ;(missingMappingError as any).code = 'MISSING_PROVIDER_MAPPING'
            throw missingMappingError
        }

        console.log(`✅ Got IntakeQ practitioner IDs for ${Object.keys(mappings).length} providers`)
        return mappings

    } catch (error: any) {
        // Re-throw structured errors
        if (error.status && error.code) {
            throw error
        }

        // Wrap unexpected errors
        console.error('❌ Unexpected error in getIntakeqPractitionerIdsBatch:', error)
        const wrappedError = new Error(`Failed to get IntakeQ practitioner mappings: ${error.message}`)
        ;(wrappedError as any).status = 500
        throw wrappedError
    }
}
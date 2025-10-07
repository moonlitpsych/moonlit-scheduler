import { supabaseAdmin } from '@/lib/supabase'

export interface ServiceInstanceWithGating {
    id: string
    service_id: string
    payer_id: string | null
    effective_date: string | null
    active: boolean
    duration_minutes: number | null
    has_integration_mapping: boolean
    integration_system?: string
    go_live_date?: string
}

/**
 * Gets service instances that meet patient-facing gating criteria:
 * - active = true
 * - have a mapping in service_instance_integrations (system in ('intakeq','practiceq'))
 * - have non-null duration_minutes via the view
 *
 * Admin/scheduler endpoints may bypass this filter by setting bypassGating = true
 */
export async function getGatedServiceInstances(options: {
    payerId?: string
    serviceId?: string
    bypassGating?: boolean
}): Promise<ServiceInstanceWithGating[]> {
    const { payerId, serviceId, bypassGating = false } = options

    try {
        // Base query for service instances with integration info
        let query = supabaseAdmin
            .from('v_service_instance_effective')
            .select(`
                id,
                service_id,
                payer_id,
                effective_date,
                active,
                duration_minutes,
                integration_mappings:service_instance_integrations(
                    system,
                    go_live_date
                )
            `)

        // Apply filters
        if (payerId) {
            query = query.or(`payer_id.eq.${payerId},payer_id.is.null`)
        }
        if (serviceId) {
            query = query.eq('service_id', serviceId)
        }

        const { data, error } = await query

        if (error) {
            console.error('❌ Error fetching service instances:', error)
            throw new Error(`Database error: ${error.message}`)
        }

        if (!data) {
            return []
        }

        // Transform and apply gating rules
        const serviceInstances: ServiceInstanceWithGating[] = data.map((row: any) => {
            const integrations = row.integration_mappings || []
            const hasValidIntegration = integrations.some((mapping: any) =>
                ['intakeq', 'practiceq'].includes(mapping.system) &&
                (!mapping.go_live_date || new Date(mapping.go_live_date) <= new Date())
            )

            return {
                id: row.id,
                service_id: row.service_id,
                payer_id: row.payer_id,
                effective_date: row.effective_date,
                active: row.active,
                duration_minutes: row.duration_minutes,
                has_integration_mapping: hasValidIntegration,
                integration_system: integrations[0]?.system,
                go_live_date: integrations[0]?.go_live_date
            }
        })

        // Apply gating filters for patient-facing endpoints
        if (!bypassGating) {
            const gatedInstances = serviceInstances.filter(instance => {
                // Must be active
                if (!instance.active) {
                    console.log(`🚫 Filtered out inactive service instance: ${instance.id}`)
                    return false
                }

                // Must have integration mapping
                if (!instance.has_integration_mapping) {
                    console.log(`🚫 Filtered out unmapped service instance: ${instance.id}`)
                    return false
                }

                // Must have duration
                if (instance.duration_minutes === null || instance.duration_minutes === undefined) {
                    console.log(`🚫 Filtered out service instance without duration: ${instance.id}`)
                    return false
                }

                return true
            })

            console.log(`🔒 Service instance gating: ${serviceInstances.length} → ${gatedInstances.length} available`)
            return gatedInstances
        }

        console.log(`🔓 Bypassing service instance gating: ${serviceInstances.length} instances`)
        return serviceInstances

    } catch (error: any) {
        console.error('❌ Error in getGatedServiceInstances:', error)
        throw error
    }
}

/**
 * Checks if a specific service instance meets patient-facing gating criteria
 */
export async function isServiceInstanceGated(serviceInstanceId: string): Promise<boolean> {
    try {
        const instances = await getGatedServiceInstances({ bypassGating: false })
        return instances.some(instance => instance.id === serviceInstanceId)
    } catch (error) {
        console.error(`❌ Error checking if service instance is gated: ${serviceInstanceId}`, error)
        return false
    }
}

/**
 * Gets the primary service instance for a provider-payer combination,
 * applying gating rules
 */
export async function getPrimaryServiceInstance(
    providerId: string,
    payerId: string,
    bypassGating = false
): Promise<ServiceInstanceWithGating | null> {
    try {
        // First get provider's services
        const { data: providerServices, error: servicesError } = await supabaseAdmin
            .from('provider_services')
            .select('service_id')
            .eq('provider_id', providerId)

        if (servicesError || !providerServices?.length) {
            console.log(`⚠️ No services found for provider ${providerId}`)
            return null
        }

        // Get gated service instances for these services
        const serviceIds = providerServices.map(ps => ps.service_id)
        const allInstances: ServiceInstanceWithGating[] = []

        for (const serviceId of serviceIds) {
            const instances = await getGatedServiceInstances({
                payerId,
                serviceId,
                bypassGating
            })
            allInstances.push(...instances)
        }

        if (allInstances.length === 0) {
            console.log(`⚠️ No gated service instances for provider ${providerId} with payer ${payerId}`)
            return null
        }

        // Sort by preference: payer-specific first, then by effective_date DESC
        const sorted = allInstances.sort((a, b) => {
            // Payer-specific instances first
            if (a.payer_id === payerId && b.payer_id !== payerId) return -1
            if (b.payer_id === payerId && a.payer_id !== payerId) return 1

            // Then by effective_date DESC
            const dateA = a.effective_date ? new Date(a.effective_date) : new Date(0)
            const dateB = b.effective_date ? new Date(b.effective_date) : new Date(0)
            return dateB.getTime() - dateA.getTime()
        })

        console.log(`✅ Selected primary service instance for provider ${providerId}: ${sorted[0].id}`)
        return sorted[0]

    } catch (error: any) {
        console.error(`❌ Error getting primary service instance for provider ${providerId}:`, error)
        return null
    }
}
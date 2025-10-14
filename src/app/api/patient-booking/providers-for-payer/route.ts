// src/app/api/patient-booking/providers-for-payer/route.ts
// CANONICAL: Uses v_bookable_provider_payer view exclusively (no fallbacks)
import { supabaseAdmin } from '@/lib/supabase'
import { BookableProviderPayer } from '@/types/database'
import { NextRequest, NextResponse } from 'next/server'
import {
    BOOKABLE_PROVIDER_SELECT,
    PROVIDER_DETAILS_SELECT,
    mapViewToLegacyFormat,
    filterProvidersByLanguage,
    groupProvidersBySupervision,
    BOOKABILITY_VIEWS,
    type BookableProviderPayerView,
    type ProviderData
} from '@/lib/bookability'
import { featureFlags } from '@/lib/config/featureFlags'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { payer_id, language = 'English', include_co_visit_info = false } = body

        if (!payer_id) {
            return NextResponse.json(
                { success: false, error: 'payer_id is required' },
                { status: 400 }
            )
        }

        console.log('🔍 NEW: Fetching bookable providers using new view:', { payer_id, language, include_co_visit_info })

        // Special handling for cash payment
        let relationships, relationshipError;

        if (payer_id === 'cash-payment') {
            console.log('💵 Cash payment detected - fetching all providers accepting new patients')

            // For cash payment, skip the canonical view and directly fetch all providers
            // that accept new patients
            const { data: cashProviders, error: cashError } = await supabaseAdmin
                .from('providers')
                .select(PROVIDER_DETAILS_SELECT)
                .eq('is_bookable', true)
                .eq('accepts_new_patients', true)

            if (cashError) {
                console.error('❌ Error fetching cash payment providers:', cashError)
                return NextResponse.json(
                    { success: false, error: 'Failed to fetch cash payment providers', details: cashError },
                    { status: 500 }
                )
            }

            // For cash payment, we'll create the response directly without relationships
            // Skip all the relationship processing and go straight to the response
            console.log(`💵 Found ${cashProviders?.length || 0} providers for cash payment`)

            // Get focus areas for cash providers
            const providersWithFocus = []
            if (cashProviders) {
                const providerIds = cashProviders.map(p => p.id)

                const { data: allFocusAreas } = await supabaseAdmin
                    .from('provider_focus_areas')
                    .select(`
                        provider_id,
                        focus_areas!inner (
                            id,
                            name,
                            slug,
                            focus_type
                        ),
                        priority,
                        confidence
                    `)
                    .in('provider_id', providerIds)
                    .eq('focus_areas.is_active', true)
                    .order('priority', { ascending: true })

                const focusAreasByProvider = (allFocusAreas || []).reduce((acc, fa) => {
                    if (!acc[fa.provider_id]) {
                        acc[fa.provider_id] = []
                    }
                    acc[fa.provider_id].push({
                        id: fa.focus_areas.id,
                        name: fa.focus_areas.name,
                        slug: fa.focus_areas.slug,
                        type: fa.focus_areas.focus_type,
                        priority: fa.priority,
                        confidence: fa.confidence
                    })
                    return acc
                }, {} as Record<string, any[]>)

                for (const provider of cashProviders) {
                    providersWithFocus.push({
                        ...provider,
                        focus_json: focusAreasByProvider[provider.id] || [],
                        // Add cash payment specific fields
                        accepted_services: [
                            {
                                service_id: 'intake-service',
                                service_instance_id: 'cash-intake-instance',
                                name: 'Intake Appointment (60m)',
                                duration_minutes: 60
                            },
                            {
                                service_id: 'followup-service',
                                service_instance_id: 'cash-followup-instance',
                                name: 'Follow-up Appointment (30m)',
                                duration_minutes: 30
                            }
                        ],
                        network_status: 'in_network',
                        billing_provider_id: null,
                        rendering_provider_id: null,
                        supervision_level: null,
                        requires_co_visit: false,
                        co_visit_provider_id: null
                    })
                }
            }

            // Apply language filtering
            const filteredProviders = filterProvidersByLanguage(providersWithFocus, language)

            console.log(`💵 Cash payment: ${filteredProviders.length} providers after language filter`)

            return NextResponse.json({
                success: true,
                data: {
                    payer_id,
                    language,
                    providers: filteredProviders,
                    total_providers: filteredProviders.length,
                    debug_info: {
                        bookable_providers_found: providersWithFocus.length,
                        direct_relationships: providersWithFocus.length,
                        supervised_relationships: 0,
                        co_visit_required: 0,
                        providers_after_language_filter: filteredProviders.length,
                        is_cash_payment: true
                    }
                }
            })
        } else {
            // CANONICAL: Use v_bookable_provider_payer view exclusively
            console.log('📡 Using canonical v_bookable_provider_payer view...')
            // Get bookable relationships from canonical view
            const result = await supabaseAdmin
                .from(BOOKABILITY_VIEWS.BOOKABLE)
                .select(BOOKABLE_PROVIDER_SELECT)
                .eq('payer_id', payer_id)

            relationships = result.data
            relationshipError = result.error
        }

        if (relationshipError) {
            console.error('❌ Error fetching from canonical view:', relationshipError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch bookable relationships', details: relationshipError },
                { status: 500 }
            )
        }

        if (!relationships || relationships.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    payer_id,
                    language,
                    providers: [],
                    total_providers: 0,
                    debug_info: {
                        bookable_providers_found: 0,
                        direct_relationships: 0,
                        supervised_relationships: 0,
                        co_visit_required: 0,
                        providers_after_language_filter: 0,
                        message: 'No bookable relationships found for this payer'
                    }
                }
            })
        }

            // Get unique provider IDs from relationships
            const providerIds = [...new Set(relationships.map(r => r.provider_id))]
            
            // Get provider details separately
            // V2.0: Filter by accepts_new_patients for intake flows when flag enabled
            let providersQuery = supabaseAdmin
                .from('providers')
                .select(PROVIDER_DETAILS_SELECT)
                .in('id', providerIds)
                .eq('is_bookable', true)

            // Apply new patient filter if feature flag enabled
            if (featureFlags.intakeHideNonIntakeProviders) {
                providersQuery = providersQuery.eq('accepts_new_patients', true)
                console.log('✅ V2.0: Filtering for accepts_new_patients=true (feature flag enabled)')
            }

            const { data: basicProviders, error: providerError } = await providersQuery

            if (providerError) {
                throw providerError
            }

            // OPTIMIZATION: Batch fetch focus areas for all providers in one query
            const providersWithFocus = []
            if (basicProviders) {
                // Single query for ALL providers' focus areas
                const { data: allFocusAreas, error: focusError } = await supabaseAdmin
                    .from('provider_focus_areas')
                    .select(`
                        provider_id,
                        focus_areas!inner (
                            id,
                            name,
                            slug,
                            focus_type
                        ),
                        priority,
                        confidence
                    `)
                    .in('provider_id', providerIds)
                    .eq('focus_areas.is_active', true)
                    .order('priority', { ascending: true })

                if (focusError) {
                    console.error('❌ Error fetching focus areas:', focusError)
                }

                // Group focus areas by provider
                const focusAreasByProvider = (allFocusAreas || []).reduce((acc, fa) => {
                    if (!acc[fa.provider_id]) {
                        acc[fa.provider_id] = []
                    }
                    acc[fa.provider_id].push({
                        id: fa.focus_areas.id,
                        name: fa.focus_areas.name,
                        slug: fa.focus_areas.slug,
                        type: fa.focus_areas.focus_type,
                        priority: fa.priority,
                        confidence: fa.confidence
                    })
                    return acc
                }, {} as Record<string, any[]>)

                // Attach focus areas to each provider
                for (const provider of basicProviders) {
                    providersWithFocus.push({
                        ...provider,
                        focus_json: focusAreasByProvider[provider.id] || []
                    })
                }
            }

            // ✅ B) Build accepted_services with real service instances from database
            const providersWithServiceInstances = []
            if (providersWithFocus) {
                // Get all service instances for this payer
                let serviceInstances, serviceError;

                if (payer_id === 'cash-payment') {
                    // For cash payment, use default telehealth service instances or create mock ones
                    console.log('💵 Using default service instances for cash payment')
                    // Create mock service instances for cash payment
                    serviceInstances = [
                        {
                            id: 'cash-intake',
                            service_id: 'intake-service',
                            services: {
                                id: 'intake-service',
                                name: 'Intake Appointment',
                                duration_minutes: 60
                            }
                        },
                        {
                            id: 'cash-followup',
                            service_id: 'followup-service',
                            services: {
                                id: 'followup-service',
                                name: 'Follow-up Appointment',
                                duration_minutes: 30
                            }
                        }
                    ]
                } else {
                    // Fetch real service instances for insurance payers
                    const result = await supabaseAdmin
                        .from('service_instances')
                        .select(`
                            id,
                            service_id,
                            services!inner(
                                id,
                                name,
                                duration_minutes
                            )
                        `)
                        .eq('payer_id', payer_id)

                    serviceInstances = result.data
                    serviceError = result.error
                }

                if (serviceError) {
                    console.error('❌ Error fetching service instances:', serviceError)
                }

                const instances = serviceInstances || []
                console.log(`📦 Found ${instances.length} service instances for payer ${payer_id}`)

                for (const provider of providersWithFocus) {
                    // Map service instances to accepted_services format
                    const accepted_services = instances.map(instance => ({
                        service_id: instance.service_id,
                        service_instance_id: instance.id,
                        name: `${instance.services.name} (${instance.services.duration_minutes}m)`,
                        duration_minutes: instance.services.duration_minutes
                    }))

                    if (accepted_services.length > 0) {
                        console.log(`✅ Provider ${provider.id}: ${accepted_services.length} service instances available`)
                    } else {
                        console.warn(`⚠️ Provider ${provider.id}: No service instances found for payer ${payer_id}`)
                    }

                    providersWithServiceInstances.push({
                        ...provider,
                        accepted_services
                    })
                }
            }

            // Join relationships with provider data using bookability mapper
            const data = relationships.map(rel => {
                const provider = providersWithServiceInstances?.find(p => p.id === rel.provider_id)
                if (!provider) return null

                const mappedProvider = mapViewToLegacyFormat(
                    rel as BookableProviderPayerView,
                    provider as ProviderData
                )

                // Add service instances to the mapped provider
                return {
                    ...mappedProvider,
                    accepted_services: provider.accepted_services
                }
            }).filter(Boolean) // Only include successful mappings

        console.log(`✅ Canonical view success: Found ${data.length} bookable providers`)
        const bookableProviders = data

        console.log(`📊 CANONICAL: Found ${bookableProviders?.length || 0} bookable providers from canonical view`)

        // Apply language filtering using bookability utilities
        const filteredProviders = filterProvidersByLanguage(bookableProviders, language)
        if (language && language !== 'English') {
            console.log(`🌍 Language filter (${language}): ${filteredProviders.length}/${bookableProviders.length} providers`)
        }

        // Providers are already in the correct format from the mapper

        // Calculate statistics using bookability utilities
        const providerStats = groupProvidersBySupervision(bookableProviders)
        
        console.log('📊 Provider breakdown:', {
            ...providerStats.stats,
            after_language_filter: filteredProviders.length
        })

        const response = {
            success: true,
            data: {
                payer_id,
                language,
                providers: filteredProviders,
                total_providers: filteredProviders.length,
                debug_info: {
                    bookable_providers_found: bookableProviders.length,
                    direct_relationships: providerStats.stats.direct,
                    supervised_relationships: providerStats.stats.supervised,
                    co_visit_required: providerStats.stats.coVisitRequired,
                    providers_after_language_filter: filteredProviders.length,
                    relationship_breakdown: {
                        direct: providerStats.stats.direct,
                        supervised: providerStats.stats.supervised
                    },
                    // Co-visit information if requested
                    ...(include_co_visit_info && {
                        co_visit_providers: filteredProviders.filter(p => p.requires_co_visit).map(p => ({
                            provider_id: p.id,
                            provider_name: `${p.first_name} ${p.last_name}`,
                            attending_provider_id: p.attending_provider_id,
                            supervision_level: p.supervision_level
                        }))
                    })
                }
            }
        }

        // Step 1: Log accepted_services snapshot
        console.log('API/providers-for-payer → accepted_services snapshot', JSON.stringify(providersWithServiceInstances, null, 2))

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('❌ Error getting providers for payer:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to get providers', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}


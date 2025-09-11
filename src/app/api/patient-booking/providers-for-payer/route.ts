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

        // CANONICAL: Use v_bookable_provider_payer view exclusively
        console.log('📡 Using canonical v_bookable_provider_payer view...')
        // Get bookable relationships from canonical view
        const { data: relationships, error: relationshipError } = await supabaseAdmin
            .from(BOOKABILITY_VIEWS.BOOKABLE)
            .select(BOOKABLE_PROVIDER_SELECT)
            .eq('payer_id', payer_id)

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
            const { data: basicProviders, error: providerError } = await supabaseAdmin
                .from('providers')
                .select(PROVIDER_DETAILS_SELECT)
                .in('id', providerIds)
                .eq('is_bookable', true)

            if (providerError) {
                throw providerError
            }

            // Get focus areas for each provider (same as /api/providers/all)
            const providersWithFocus = []
            if (basicProviders) {
                for (const provider of basicProviders) {
                    // Get focus areas for this provider
                    const { data: focusAreas, error: focusError } = await supabaseAdmin
                        .from('provider_focus_areas')
                        .select(`
                            focus_areas!inner (
                                id,
                                name,
                                slug,
                                focus_type
                            ),
                            priority,
                            confidence
                        `)
                        .eq('provider_id', provider.id)
                        .eq('focus_areas.is_active', true)
                        .order('priority', { ascending: true })

                    const focus_json = focusAreas ? focusAreas.map(fa => ({
                        id: fa.focus_areas.id,
                        name: fa.focus_areas.name,
                        slug: fa.focus_areas.slug,
                        type: fa.focus_areas.focus_type,
                        priority: fa.priority,
                        confidence: fa.confidence
                    })) : []

                    providersWithFocus.push({
                        ...provider,
                        focus_json
                    })
                }
            }

            // Join relationships with provider data using bookability mapper
            const data = relationships.map(rel => {
                const provider = providersWithFocus?.find(p => p.id === rel.provider_id)
                if (!provider) return null
                
                return mapViewToLegacyFormat(
                    rel as BookableProviderPayerView, 
                    provider as ProviderData
                )
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


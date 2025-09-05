// src/app/api/patient-booking/providers-for-payer/route.ts
// UPDATED: Uses new bookable_provider_payers_v2 view for optimized performance
import { supabaseAdmin } from '@/lib/supabase'
import { BookableProviderPayer } from '@/types/database'
import { NextRequest, NextResponse } from 'next/server'

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

        console.log('🔍 NEW: Fetching bookable providers using v2 view:', { payer_id, language, include_co_visit_info })

        // SIMPLIFIED: Single query to new optimized view with fallback
        let bookableProviders = null
        let viewError = null

        try {
            console.log('📡 Attempting to use bookable_provider_payers_v2 view...')
            // First get bookable relationships from v2 view
            const { data: relationships, error: relationshipError } = await supabaseAdmin
                .from('bookable_provider_payers_v2')
                .select(`
                    provider_id,
                    payer_id,
                    via,
                    attending_provider_id,
                    supervision_level,
                    requires_co_visit,
                    effective,
                    bookable_from_date
                `)
                .eq('payer_id', payer_id)

            if (relationshipError) {
                throw relationshipError
            }

            if (!relationships || relationships.length === 0) {
                throw new Error('No bookable relationships found for this payer')
            }

            // Get unique provider IDs from relationships
            const providerIds = [...new Set(relationships.map(r => r.provider_id))]
            
            // Get provider details separately
            const { data: providers, error: providerError } = await supabaseAdmin
                .from('providers')
                .select(`
                    id,
                    first_name,
                    last_name,
                    title,
                    role,
                    provider_type,
                    is_active,
                    is_bookable,
                    languages_spoken,
                    profile_image_url,
                    about
                `)
                .in('id', providerIds)
                .eq('is_bookable', true)

            if (providerError) {
                throw providerError
            }

            // Join relationships with provider data
            const data = relationships.map(rel => {
                const provider = providers?.find(p => p.id === rel.provider_id)
                return {
                    ...rel,
                    ...provider
                }
            }).filter(item => item.first_name) // Only include items where provider was found

            console.log(`✅ v2 view success: Found ${data.length} bookable providers`)
            bookableProviders = data
        } catch (error: any) {
            console.warn('⚠️ v2 view not accessible, falling back to legacy logic:', error.message)
            viewError = error
        }

        // FALLBACK: Use legacy logic if v2 view not ready
        if (viewError || !bookableProviders) {
            console.log('🔄 FALLBACK: Using legacy provider-payer networks logic')
            return await handleLegacyProviderFetch(payer_id, language)
        }

        console.log(`📊 NEW: Found ${bookableProviders?.length || 0} bookable providers from optimized view`)
        
        if (!bookableProviders || bookableProviders.length === 0) {
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
                        providers_after_language_filter: 0
                    }
                }
            })
        }

        // Apply language filtering if specified and not English
        let filteredProviders = bookableProviders
        if (language && language !== 'English') {
            filteredProviders = bookableProviders.filter(provider => {
                if (!provider.languages_spoken) return false
                
                // Handle different data types for languages_spoken
                let languages: string[] = []
                if (Array.isArray(provider.languages_spoken)) {
                    languages = provider.languages_spoken
                } else if (typeof provider.languages_spoken === 'string') {
                    try {
                        languages = JSON.parse(provider.languages_spoken)
                    } catch {
                        languages = [provider.languages_spoken]
                    }
                }
                
                return languages.some(lang => 
                    lang.toLowerCase().includes(language.toLowerCase())
                )
            })
            console.log(`🌍 Language filter (${language}): ${filteredProviders.length}/${bookableProviders.length} providers`)
        }

        // Transform view data to match expected provider format
        const providers = filteredProviders.map(bp => ({
            id: bp.provider_id,
            first_name: bp.first_name || '',
            last_name: bp.last_name || '',
            title: bp.title || 'MD',
            role: bp.role || 'physician',
            provider_type: bp.provider_type || 'attending',
            is_active: bp.is_active,
            is_bookable: bp.is_bookable,
            languages_spoken: bp.languages_spoken,
            profile_image_url: bp.profile_image_url,
            about: bp.about,
            
            // NEW: Supervision-specific fields
            via: bp.via, // 'direct' | 'supervised'
            attending_provider_id: bp.attending_provider_id,
            supervision_level: bp.supervision_level,
            requires_co_visit: bp.requires_co_visit,
            effective: bp.effective,
            bookable_from_date: bp.bookable_from_date,
            
            // Legacy compatibility fields
            network_effective_date: bp.effective,
            network_status: 'in_network', // All results from view are in-network
            relationship_type: bp.via // Map to old field name
        }))

        // Calculate statistics for debugging
        const directCount = bookableProviders.filter(bp => bp.via === 'direct').length
        const supervisedCount = bookableProviders.filter(bp => bp.via === 'supervised').length
        const coVisitCount = bookableProviders.filter(bp => bp.requires_co_visit).length
        
        console.log('📊 Provider breakdown:', {
            total: bookableProviders.length,
            direct: directCount,
            supervised: supervisedCount,
            requires_co_visit: coVisitCount,
            after_language_filter: providers.length
        })

        const response = {
            success: true,
            data: {
                payer_id,
                language,
                providers,
                total_providers: providers.length,
                debug_info: {
                    bookable_providers_found: bookableProviders.length,
                    direct_relationships: directCount,
                    supervised_relationships: supervisedCount,
                    co_visit_required: coVisitCount,
                    providers_after_language_filter: providers.length,
                    relationship_breakdown: {
                        direct: directCount,
                        supervised: supervisedCount
                    },
                    // NEW: Co-visit information if requested
                    ...(include_co_visit_info && {
                        co_visit_providers: providers.filter(p => p.requires_co_visit).map(p => ({
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

// FALLBACK FUNCTION: Legacy provider-payer logic for when v2 view isn't ready
async function handleLegacyProviderFetch(payer_id: string, language: string) {
    try {
        console.log('🔄 Using legacy provider-payer networks approach')

        // Get direct provider-payer networks (original logic)
        const { data: directNetworks, error: directError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                payer_id,
                effective_date,
                status
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'in_network')

        if (directError) {
            console.error('❌ Error fetching direct networks:', directError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch direct networks', details: directError },
                { status: 500 }
            )
        }

        if (!directNetworks || directNetworks.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    payer_id,
                    language,
                    providers: [],
                    total_providers: 0,
                    debug_info: {
                        fallback_mode: true,
                        networks_found: 0,
                        message: 'No provider networks found for this payer'
                    }
                }
            })
        }

        // Get unique provider IDs
        const providerIds = [...new Set(directNetworks.map(n => n.provider_id))]
        
        // Fetch provider details
        const { data: providersData, error: providersError } = await supabaseAdmin
            .from('providers')
            .select(`
                id,
                first_name,
                last_name,
                title,
                role,
                provider_type,
                is_active,
                languages_spoken,
                telehealth_enabled,
                accepts_new_patients,
                is_bookable,
                profile_image_url,
                about
            `)
            .in('id', providerIds)
            .eq('is_active', true)

        if (providersError) {
            console.error('❌ Error fetching providers:', providersError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch providers', details: providersError },
                { status: 500 }
            )
        }

        // Combine network data with provider details
        let providers = directNetworks?.map(network => {
            const providerData = providersData?.find(p => p.id === network.provider_id)
            if (!providerData) return null
            
            return {
                ...providerData,
                network_effective_date: network.effective_date,
                network_status: network.status,
                relationship_type: 'direct', // Legacy field
                via: 'direct', // New field for compatibility
                attending_provider_id: null,
                supervision_level: null,
                requires_co_visit: false
            }
        }).filter(Boolean) || []

        // Apply language filtering if specified
        if (language && language !== 'English') {
            providers = providers.filter(provider => {
                if (!provider.languages_spoken) return false
                
                let languages: string[] = []
                if (Array.isArray(provider.languages_spoken)) {
                    languages = provider.languages_spoken
                } else if (typeof provider.languages_spoken === 'string') {
                    try {
                        languages = JSON.parse(provider.languages_spoken)
                    } catch {
                        languages = [provider.languages_spoken]
                    }
                }
                
                return languages.some(lang => 
                    lang.toLowerCase().includes(language.toLowerCase())
                )
            })
        }

        console.log(`✅ Legacy mode: Found ${providers.length} providers for payer ${payer_id}`)

        return NextResponse.json({
            success: true,
            data: {
                payer_id,
                language,
                providers,
                total_providers: providers.length,
                debug_info: {
                    fallback_mode: true,
                    networks_found: directNetworks?.length || 0,
                    providers_after_language_filter: providers.length,
                    message: 'Using legacy provider-payer networks (v2 view not ready)'
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Legacy fallback error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Legacy provider fetch failed', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
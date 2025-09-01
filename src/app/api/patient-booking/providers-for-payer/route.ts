// src/app/api/patient-booking/providers-for-payer/route.ts
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { payer_id, language = 'English' } = body

        if (!payer_id) {
            return NextResponse.json(
                { success: false, error: 'payer_id is required' },
                { status: 400 }
            )
        }

        console.log('🔍 Fetching providers for payer:', { payer_id, language })

        // Get direct provider-payer networks
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

        // Also get supervision relationships (if table exists)
        const { data: supervisionNetworks } = await supabaseAdmin
            .from('supervision_relationships')
            .select(`
                rendering_provider_id,
                billing_provider_id,
                payer_id,
                effective_date,
                status
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'active')

        console.log('🔗 Direct networks:', directNetworks?.length || 0)
        console.log('👨‍⚕️ Supervision relationships:', supervisionNetworks?.length || 0)

        // Combine direct and supervision relationships
        const allNetworks = [
            ...(directNetworks || []).map(n => ({
                provider_id: n.provider_id,
                payer_id: n.payer_id,
                effective_date: n.effective_date,
                status: n.status,
                billing_provider_id: n.provider_id, // same as provider (direct)
                rendering_provider_id: null,
                relationship_type: 'direct'
            })),
            ...(supervisionNetworks || []).map(n => ({
                provider_id: n.rendering_provider_id, // the provider who renders service
                payer_id: n.payer_id,
                effective_date: n.effective_date,
                status: n.status,
                billing_provider_id: n.billing_provider_id, // who bills
                rendering_provider_id: n.rendering_provider_id, // who renders
                relationship_type: 'supervision'
            }))
        ]

        const networks = allNetworks

        console.log('👥 Found networks:', networks?.length || 0)

        if (!networks || networks.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    payer_id,
                    language,
                    providers: [],
                    total_providers: 0,
                    debug_info: {
                        networks_found: 0,
                        direct_networks: directNetworks?.length || 0,
                        supervision_networks: supervisionNetworks?.length || 0,
                        providers_after_language_filter: 0,
                        relationship_breakdown: {}
                    }
                }
            })
        }

        // Get unique provider IDs
        const providerIds = [...new Set(networks.map(n => n.provider_id))]
        
        // Fetch provider details separately
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
                availability,
                is_bookable,
                profile_image_url,
                about,
                what_i_look_for_in_a_patient,
                med_school_org,
                med_school_grad_year,
                residency_org,
                provider_licenses(
                    license_type,
                    issuing_state
                )
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

        // Combine network data with provider details (with supervision support)
        let providers = networks?.map(network => {
            const providerData = providersData?.find(p => p.id === network.provider_id)
            if (!providerData) return null
            
            return {
                ...providerData,
                network_effective_date: network.effective_date,
                network_status: network.status,
                billing_provider_id: network.billing_provider_id,
                rendering_provider_id: network.rendering_provider_id,
                relationship_type: network.relationship_type, // 'direct' or 'supervision'
                // Add license information for state filtering
                state_licenses: providerData.provider_licenses?.map(license => license.issuing_state) || []
            }
        }).filter(Boolean) || []

        // Filter by language if specified and not English
        if (language && language !== 'English') {
            providers = providers.filter(provider => {
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
        }

        console.log(`✅ Filtered providers for ${language}:`, providers.length)

        const response = {
            success: true,
            data: {
                payer_id,
                language,
                providers,
                total_providers: providers.length,
                debug_info: {
                    networks_found: networks?.length || 0,
                    direct_networks: directNetworks?.length || 0,
                    supervision_networks: supervisionNetworks?.length || 0,
                    providers_after_language_filter: providers.length,
                    relationship_breakdown: providers.reduce((acc, p) => {
                        acc[p.relationship_type] = (acc[p.relationship_type] || 0) + 1
                        return acc
                    }, {})
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
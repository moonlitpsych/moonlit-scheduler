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

        // FIXED: Use correct table name 'provider_payer_networks' instead of 'provider_payer_relationships'
        const { data: networks, error: networksError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                effective_date,
                status,
                providers!inner(
                    id,
                    first_name,
                    last_name,
                    title,
                    role,
                    is_active,
                    languages_spoken,
                    telehealth_enabled,
                    accepts_new_patients,
                    profile_image_url,
                    provider_licenses(
                        license_type,
                        issuing_state
                    )
                )
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'in_network')
            .eq('providers.is_active', true)

        if (networksError) {
            console.error('❌ Error fetching provider networks:', networksError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider networks', details: networksError },
                { status: 500 }
            )
        }

        console.log('👥 Found networks:', networks?.length || 0)

        // Extract and filter providers
        let providers = networks?.map(network => ({
            ...network.providers,
            network_effective_date: network.effective_date,
            network_status: network.status,
            // Add license information for state filtering
            state_licenses: network.providers.provider_licenses?.map(license => license.issuing_state) || []
        })) || []

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
                    providers_after_language_filter: providers.length
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
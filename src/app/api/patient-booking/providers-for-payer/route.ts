import { supabase } from '@/lib/supabase'
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

        // Get providers who accept this payer
        const { data: networks, error: networksError } = await supabase
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
                    accepts_new_patients
                )
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'active')
            .eq('providers.is_active', true)

        if (networksError) {
            console.error('❌ Error fetching provider networks:', networksError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider networks' },
                { status: 500 }
            )
        }

        console.log('👥 Found networks:', networks?.length || 0)

        // Extract and filter providers
        let providers = networks?.map(network => ({
            ...network.providers,
            network_effective_date: network.effective_date,
            network_status: network.status
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

        console.log('🌐 Providers after language filter:', providers.length)

        return NextResponse.json({
            success: true,
            data: {
                providers,
                totalCount: providers.length,
                language,
                payer_id
            }
        })

    } catch (error) {
        console.error('💥 Error in providers-for-payer API:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
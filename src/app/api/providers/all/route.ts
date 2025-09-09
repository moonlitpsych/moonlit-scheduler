import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        console.log('👥 Fetching providers enabled for practitioners directory (list_on_provider_page=true)...')

        // Get providers that should be listed on provider page
        // First get basic provider data
        const { data: basicProviders, error: basicError } = await supabaseAdmin
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
                accepts_new_patients,
                list_on_provider_page,
                languages_spoken,
                profile_image_url,
                about,
                med_school_org,
                med_school_grad_year,
                residency_org,
                provider_licenses(license_type, issuing_state)
            `)
            .eq('is_active', true)
            .eq('list_on_provider_page', true)
            .order('last_name')

        if (basicError) {
            console.error('❌ Error fetching basic providers:', basicError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch providers', details: basicError },
                { status: 500 }
            )
        }

        // Then get focus areas for each provider
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

        const providers = providersWithFocus

        if (!providers || providers.length === 0) {
            console.log('⚠️ No providers found with list_on_provider_page=true')
            return NextResponse.json({
                success: true,
                data: {
                    providers: [],
                    total_providers: 0,
                    debug_info: {
                        message: 'No providers found with list_on_provider_page=true'
                    }
                }
            })
        }

        // Transform provider data to match expected format
        const transformedProviders = providers.map(provider => ({
            id: provider.id,
            first_name: provider.first_name || '',
            last_name: provider.last_name || '',
            title: provider.title || 'MD',
            role: provider.role || 'physician',
            provider_type: provider.provider_type || 'attending',
            is_active: provider.is_active,
            is_bookable: provider.is_bookable,
            accepts_new_patients: provider.accepts_new_patients,
            list_on_provider_page: provider.list_on_provider_page,
            languages_spoken: provider.languages_spoken,
            focus_json: provider.focus_json || null,
            specialties: ['Psychiatry'], // Default specialty for practitioners directory
            specialty: 'Psychiatry',
            profile_image_url: provider.profile_image_url,
            about: provider.about,
            med_school_org: provider.med_school_org,
            med_school_grad_year: provider.med_school_grad_year,
            residency_org: provider.residency_org,
            
            // Transform license data to state_licenses array for compatibility
            state_licenses: provider.provider_licenses?.map(license => 
                `${license.issuing_state} ${license.license_type}`
            ) || [],
            
            // Provider status for display - only for bookable providers
            availability: provider.is_bookable 
                ? (provider.accepts_new_patients ? 'Accepting New Patients' : 'Established Patients Only')
                : null, // Non-bookable providers don't show availability status
            
            new_patient_status: provider.is_bookable 
                ? (provider.accepts_new_patients ? 'Accepting New Patients' : 'Established Patients Only')
                : null // Non-bookable providers don't show patient status
        }))

        // Separate bookable vs non-bookable for debugging
        const bookableProviders = transformedProviders.filter(p => p.is_bookable)
        const nonBookableProviders = transformedProviders.filter(p => !p.is_bookable)

        console.log(`✅ Found ${transformedProviders.length} providers with list_on_provider_page=true`)
        console.log(`   📋 Bookable (${bookableProviders.length}): ${bookableProviders.map(p => `${p.first_name} ${p.last_name}`).join(', ')}`)
        console.log(`   📋 Non-bookable (${nonBookableProviders.length}): ${nonBookableProviders.map(p => `${p.first_name} ${p.last_name}`).join(', ')}`)

        return NextResponse.json({
            success: true,
            data: {
                providers: transformedProviders,
                total_providers: transformedProviders.length,
                debug_info: {
                    total_providers_listed: transformedProviders.length,
                    bookable_providers: bookableProviders.length,
                    non_bookable_providers: nonBookableProviders.length,
                    bookable_names: bookableProviders.map(p => `${p.first_name} ${p.last_name}`),
                    non_bookable_names: nonBookableProviders.map(p => `${p.first_name} ${p.last_name}`),
                    message: 'Providers with list_on_provider_page=true returned for practitioners directory display'
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Error in all providers API:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to fetch all providers', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
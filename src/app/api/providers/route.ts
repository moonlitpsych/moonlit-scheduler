import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const focusSlug = searchParams.get('focus')
        const searchQuery = searchParams.get('q')
        const payer = searchParams.get('payer')

        console.log('🔍 Providers API called with:', { focusSlug, searchQuery, payer })

        let query = supabaseAdmin
            .from('v_providers_with_focus')
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
                focus_json,
                provider_licenses(license_type, issuing_state)
            `)

        // Base filters
        query = query
            .eq('is_active', true)
            .eq('is_bookable', true)
            .eq('accepts_new_patients', true)

        if (focusSlug) {
            // Filter by specific focus area slug
            console.log('🎯 Filtering by focus slug:', focusSlug)
            query = query.contains('focus_slugs', [focusSlug])
        } else if (searchQuery) {
            // Free-text search on focus areas
            console.log('🔍 Free-text search:', searchQuery)
            
            // First find matching focus areas
            const { data: matchingFocusAreas, error: focusError } = await supabaseAdmin
                .from('focus_areas')
                .select('id')
                .eq('is_active', true)
                .or(`name.ilike.%${searchQuery}%,synonyms.cs.{${searchQuery}}`)
                .limit(25)

            if (focusError) {
                console.error('❌ Error finding focus areas:', focusError)
            } else if (matchingFocusAreas && matchingFocusAreas.length > 0) {
                // Get providers who have any of these focus areas
                const focusIds = matchingFocusAreas.map(f => f.id)
                
                const { data: providerIds, error: providerFocusError } = await supabaseAdmin
                    .from('provider_focus_areas')
                    .select('provider_id')
                    .in('focus_area_id', focusIds)

                if (!providerFocusError && providerIds && providerIds.length > 0) {
                    const uniqueProviderIds = [...new Set(providerIds.map(p => p.provider_id))]
                    query = query.in('id', uniqueProviderIds)
                } else {
                    // No providers found with matching focus areas
                    console.log('⚠️ No providers found with matching focus areas')
                    return NextResponse.json({
                        success: true,
                        data: [],
                        total: 0,
                        filters: { focusSlug, searchQuery, payer }
                    })
                }
            }
        }

        // Execute the query
        const { data: providers, error } = await query.order('last_name')

        if (error) {
            console.error('❌ Error fetching providers:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch providers', details: error },
                { status: 500 }
            )
        }

        if (!providers) {
            return NextResponse.json({
                success: true,
                data: [],
                total: 0,
                filters: { focusSlug, searchQuery, payer }
            })
        }

        // Transform provider data
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
            profile_image_url: provider.profile_image_url,
            about: provider.about,
            med_school_org: provider.med_school_org,
            med_school_grad_year: provider.med_school_grad_year,
            residency_org: provider.residency_org,
            focus_json: provider.focus_json || null,
            
            // Transform license data to state_licenses array for compatibility
            state_licenses: provider.provider_licenses?.map(license => 
                `${license.issuing_state} ${license.license_type}`
            ) || [],
        }))

        console.log(`✅ Found ${transformedProviders.length} providers`)
        if (focusSlug || searchQuery) {
            console.log(`🔍 Filter results: focus="${focusSlug}", query="${searchQuery}"`)
        }

        return NextResponse.json({
            success: true,
            data: transformedProviders,
            total: transformedProviders.length,
            filters: { focusSlug, searchQuery, payer }
        })

    } catch (error: any) {
        console.error('❌ Error in providers API:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to fetch providers', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ provider_id: string }> }
) {
    try {
        const { provider_id } = await params

        if (!provider_id) {
            return NextResponse.json(
                { success: false, error: 'provider_id is required' },
                { status: 400 }
            )
        }

        console.log('🔍 Fetching provider:', provider_id)

        // Fetch the specific provider
        const { data: provider, error: providerError } = await supabaseAdmin
            .from('providers')
            .select(`
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
                about,
                what_i_look_for_in_a_patient,
                med_school_org,
                med_school_grad_year,
                residency_org
            `)
            .eq('id', provider_id)
            .eq('is_active', true)
            .single()

        if (providerError) {
            console.error('❌ Error fetching provider:', providerError)
            return NextResponse.json(
                { success: false, error: 'Provider not found', details: providerError },
                { status: 404 }
            )
        }

        if (!provider) {
            return NextResponse.json(
                { success: false, error: 'Provider not found' },
                { status: 404 }
            )
        }

        console.log(`✅ Found provider: ${provider.first_name} ${provider.last_name}`)

        return NextResponse.json({
            success: true,
            provider
        })

    } catch (error: any) {
        console.error('❌ Error getting provider:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to get provider', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
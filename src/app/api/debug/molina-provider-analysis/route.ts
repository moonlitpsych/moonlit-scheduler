import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET() {
    try {
        const molinaPayerId = '8b48c3e2-f555-4d67-8122-c086466ba97d'
        
        console.log('🔍 Analyzing Molina Utah provider networks...')
        
        // Check provider-payer networks for Molina
        const { data: networks, error: networksError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                status,
                effective_date,
                providers (
                    id,
                    first_name,
                    last_name,
                    is_active,
                    is_bookable,
                    accepts_new_patients
                )
            `)
            .eq('payer_id', molinaPayerId)

        if (networksError) {
            console.error('❌ Error fetching networks:', networksError)
            return NextResponse.json({ error: networksError.message }, { status: 500 })
        }

        // Check what merged-availability query would find
        const { data: mergedQuery, error: mergedError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                effective_date,
                status,
                providers!inner (
                    id,
                    first_name,
                    last_name,
                    title,
                    role,
                    is_active,
                    is_bookable,
                    accepts_new_patients,
                    telehealth_enabled
                )
            `)
            .eq('payer_id', molinaPayerId)
            .eq('status', 'in_network')
            .eq('providers.is_active', true)
            .neq('providers.is_bookable', false)

        if (mergedError) {
            console.error('❌ Error with merged query:', mergedError)
        }

        return NextResponse.json({
            molina_payer_id: molinaPayerId,
            all_networks: networks || [],
            merged_availability_query_result: mergedQuery || [],
            analysis: {
                total_networks: networks?.length || 0,
                bookable_networks: mergedQuery?.length || 0,
                network_details: networks?.map(n => ({
                    provider_name: `${n.providers?.first_name} ${n.providers?.last_name}`,
                    is_active: n.providers?.is_active,
                    is_bookable: n.providers?.is_bookable,
                    network_status: n.status,
                    effective_date: n.effective_date
                })) || []
            }
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
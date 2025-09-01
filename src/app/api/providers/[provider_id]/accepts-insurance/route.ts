import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ provider_id: string }> }
) {
    try {
        const { provider_id } = await params
        const { payer_id } = await request.json()

        if (!provider_id || !payer_id) {
            return NextResponse.json(
                { success: false, error: 'provider_id and payer_id are required' },
                { status: 400 }
            )
        }

        console.log('🔍 Checking insurance acceptance:', { provider_id, payer_id })

        // FALLBACK: Check using original table while investigating view
        const { data: network, error: networkError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                payer_id,
                status,
                effective_date,
                payers(name)
            `)
            .eq('provider_id', provider_id)
            .eq('payer_id', payer_id)
            .eq('status', 'in_network')
            .single()

        if (networkError && networkError.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('❌ Error checking insurance:', networkError)
            return NextResponse.json(
                { success: false, error: 'Failed to check insurance acceptance', details: networkError },
                { status: 500 }
            )
        }

        const accepts = !!network
        const insuranceName = network?.payers?.name || 'Selected Insurance'

        console.log(`${accepts ? '✅' : '❌'} Provider ${accepts ? 'accepts' : 'does not accept'} insurance`, {
            fallback_mode: 'Using provider_payer_networks table - no supervision model yet',
            supervision_info: accepts ? {
                billing_provider_id: provider_id, // fallback: same as provider
                rendering_provider_id: null, // fallback: no rendering provider
                direct_contract: true // fallback: assume direct contract
            } : null
        })

        return NextResponse.json({
            success: true,
            accepts,
            insuranceName,
            network: network || null,
            supervision_info: accepts ? {
                billing_provider_id: provider_id, // fallback: same as provider
                rendering_provider_id: null, // fallback: no rendering provider
                is_supervised: false // fallback: no supervision
            } : null
        })

    } catch (error: any) {
        console.error('❌ Error checking insurance acceptance:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to check insurance acceptance', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
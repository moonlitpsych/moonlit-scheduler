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

        console.log('🏥 Fetching accepted payments for provider:', provider_id)

        // First check if provider is bookable
        const { data: provider, error: providerError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_bookable')
            .eq('id', provider_id)
            .single()

        if (providerError || !provider) {
            console.error('❌ Provider not found:', providerError)
            return NextResponse.json(
                { success: false, error: 'Provider not found' },
                { status: 404 }
            )
        }

        // If provider is not bookable, return only basic info
        if (provider.is_bookable === false) {
            return NextResponse.json({
                success: true,
                data: {
                    provider_id,
                    provider_name: `${provider.first_name} ${provider.last_name}`,
                    is_bookable: false,
                    accepted_payments: [],
                    self_pay_available: false
                }
            })
        }

        let acceptedPayers: any[] = []
        let payerError = null

        try {
            console.log('📡 Attempting to use v_bookable_provider_payer view...')
            // Try to get bookable relationships from new view
            const { data: relationships, error: relationshipError } = await supabaseAdmin
                .from('v_bookable_provider_payer')
                .select(`
                    provider_id,
                    payer_id,
                    network_status,
                    billing_provider_id,
                    rendering_provider_id,
                    effective_date,
                    bookable_from_date
                `)
                .eq('provider_id', provider_id)

            if (relationshipError) {
                throw relationshipError
            }

            if (relationships && relationships.length > 0) {
                // Get payer details for the relationships
                const payerIds = [...new Set(relationships.map(r => r.payer_id))]
                
                const { data: payers, error: payersError } = await supabaseAdmin
                    .from('payers')
                    .select(`
                        id,
                        name,
                        payer_type,
                        state,
                        status_code,
                        effective_date,
                        projected_effective_date
                    `)
                    .in('id', payerIds)
                    .not('status_code', 'in', '(not_started,denied,on_pause,blocked,withdrawn)')

                if (payersError) {
                    throw payersError
                }

                acceptedPayers = payers || []
                console.log(`✅ new view success: Found ${acceptedPayers.length} accepted payers`)
            } else {
                console.log('⚠️ No relationships found in new view')
                acceptedPayers = []
            }
        } catch (error: any) {
            console.warn('⚠️ new view not accessible, falling back to legacy logic:', error.message)
            payerError = error
        }

        // FALLBACK: Use legacy provider_payer_networks if new view not ready
        if (payerError || acceptedPayers.length === 0) {
            console.log('🔄 FALLBACK: Using legacy provider_payer_networks logic')
            
            const { data: directNetworks, error: directError } = await supabaseAdmin
                .from('provider_payer_networks')
                .select(`
                    provider_id,
                    payer_id,
                    effective_date,
                    status
                `)
                .eq('provider_id', provider_id)
                .eq('status', 'in_network')

            if (directError) {
                console.error('❌ Error fetching direct networks:', directError)
            } else if (directNetworks && directNetworks.length > 0) {
                // Get payer details for direct networks
                const payerIds = [...new Set(directNetworks.map(n => n.payer_id))]
                
                const { data: payers, error: payersError } = await supabaseAdmin
                    .from('payers')
                    .select(`
                        id,
                        name,
                        payer_type,
                        state,
                        status_code,
                        effective_date,
                        projected_effective_date
                    `)
                    .in('id', payerIds)
                    .not('status_code', 'in', '(not_started,denied,on_pause,blocked,withdrawn)')

                if (!payersError && payers) {
                    acceptedPayers = payers
                    console.log(`✅ Legacy fallback success: Found ${acceptedPayers.length} accepted payers`)
                }
            }
        }

        // Filter and format the accepted payments
        const acceptedPayments = acceptedPayers.map(payer => ({
            id: payer.id,
            name: payer.name,
            type: payer.payer_type,
            state: payer.state,
            status: payer.status_code,
            is_active: payer.status_code === 'approved' && payer.effective_date,
            is_projected: payer.status_code === 'approved' && !payer.effective_date,
            display_name: payer.name
        })).filter(payment => 
            // Include active and projected payments, exclude problematic ones
            payment.status === 'approved' || payment.status === 'in_progress' || payment.status === 'waiting_on_them'
        ).sort((a, b) => {
            // Sort by: active first, then by name
            if (a.is_active && !b.is_active) return -1
            if (!a.is_active && b.is_active) return 1
            return a.display_name.localeCompare(b.display_name)
        })

        const response = {
            success: true,
            data: {
                provider_id,
                provider_name: `${provider.first_name} ${provider.last_name}`,
                is_bookable: true,
                accepted_payments: acceptedPayments,
                self_pay_available: true, // Always available for bookable providers
                debug_info: {
                    total_payers_found: acceptedPayers.length,
                    filtered_payments: acceptedPayments.length,
                    used_new_view: !payerError,
                    fallback_mode: !!payerError
                }
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('❌ Error getting accepted payments:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to get accepted payments', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
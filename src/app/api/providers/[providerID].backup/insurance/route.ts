// API endpoint to fetch insurance/payer information for a specific provider
import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: { providerID: string } }
) {
    try {
        const providerId = params.providerID

        if (!providerId) {
            return NextResponse.json(
                { success: false, error: 'Provider ID is required' },
                { status: 400 }
            )
        }

        console.log('🔍 Fetching insurance data for provider:', providerId)

        // Fetch provider insurance relationships from provider_payer_networks
        const { data: networks, error: networksError } = await supabase
            .from('provider_payer_networks')
            .select(`
                effective_date,
                status,
                payers!inner(
                    id,
                    name,
                    payer_type,
                    state
                )
            `)
            .eq('provider_id', providerId)
            .eq('status', 'in_network')

        if (networksError) {
            console.error('❌ Error fetching provider insurance:', networksError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider insurance data', details: networksError },
                { status: 500 }
            )
        }

        console.log('✅ Found insurance networks:', networks?.length || 0)

        // Extract payer information and group by type
        const payerData = networks?.map(network => ({
            id: network.payers.id,
            name: network.payers.name,
            type: network.payers.payer_type,
            state: network.payers.state,
            effective_date: network.effective_date
        })) || []

        // Group payers by type
        const insuranceTypes = {
            self_pay: ['Cash', 'Credit card', 'ACH'],
            medicaid: payerData.filter(p => p.type === 'medicaid').map(p => p.name),
            commercial: payerData.filter(p => p.type === 'commercial').map(p => p.name),
            other: payerData.filter(p => p.type && !['medicaid', 'commercial'].includes(p.type)).map(p => p.name)
        }

        const response = {
            success: true,
            data: {
                provider_id: providerId,
                insurance_types: insuranceTypes,
                raw_payers: payerData,
                total_payers: payerData.length
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('❌ Error getting provider insurance:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to get provider insurance data', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
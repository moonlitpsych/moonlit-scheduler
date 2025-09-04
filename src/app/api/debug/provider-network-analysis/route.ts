import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        console.log('🔍 Analyzing provider-payer network relationships...')
        
        // Get all providers and their bookability status
        const { data: providers, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_active, is_bookable, accepts_new_patients')
            .order('last_name')

        if (providersError) {
            console.error('❌ Error fetching providers:', providersError)
            return NextResponse.json({ error: providersError.message }, { status: 500 })
        }

        // Get all provider-payer networks
        const { data: networks, error: networksError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select(`
                provider_id,
                payer_id,
                status,
                effective_date,
                payers (
                    id,
                    name,
                    payer_type,
                    state,
                    status_code
                )
            `)
            .order('payer_id')

        if (networksError) {
            console.error('❌ Error fetching networks:', networksError)
            return NextResponse.json({ error: networksError.message }, { status: 500 })
        }

        // Get key payers we're investigating
        const { data: keyPayers, error: payersError } = await supabaseAdmin
            .from('payers')
            .select('*')
            .or('name.ilike.%Utah Health Plans%,name.ilike.%Molina%,name.ilike.%UUHP%')
            .order('name')

        if (payersError) {
            console.error('❌ Error fetching key payers:', payersError)
        }

        // Check for supervision relationships
        const { data: supervisionRelationships } = await supabaseAdmin
            .from('supervision_relationships')
            .select('*')
            .limit(10)

        // Analyze the data
        const totalProviders = providers?.length || 0
        const activeProviders = providers?.filter(p => p.is_active).length || 0
        const bookableProviders = providers?.filter(p => p.is_active && p.is_bookable !== false).length || 0
        
        const totalNetworks = networks?.length || 0
        const activeNetworks = networks?.filter(n => n.status === 'in_network').length || 0
        
        // Group networks by payer
        const networksByPayer = networks?.reduce((acc, network) => {
            const payerName = network.payers?.name || 'Unknown'
            if (!acc[payerName]) {
                acc[payerName] = []
            }
            acc[payerName].push({
                provider_id: network.provider_id,
                status: network.status,
                effective_date: network.effective_date
            })
            return acc
        }, {} as Record<string, any[]>) || {}

        // Group networks by provider
        const networksByProvider = networks?.reduce((acc, network) => {
            if (!acc[network.provider_id]) {
                acc[network.provider_id] = []
            }
            acc[network.provider_id].push({
                payer_name: network.payers?.name,
                payer_type: network.payers?.payer_type,
                status: network.status,
                effective_date: network.effective_date
            })
            return acc
        }, {} as Record<string, any[]>) || {}

        // Find providers with no networks
        const providersWithNoNetworks = providers?.filter(p => 
            !networksByProvider[p.id] || networksByProvider[p.id].length === 0
        ) || []

        const response = {
            summary: {
                total_providers: totalProviders,
                active_providers: activeProviders,
                bookable_providers: bookableProviders,
                total_networks: totalNetworks,
                active_networks: activeNetworks,
                supervision_relationships: supervisionRelationships?.length || 0
            },
            providers: providers?.map(p => ({
                ...p,
                network_count: networksByProvider[p.id]?.length || 0,
                networks: networksByProvider[p.id] || []
            })),
            key_payers: keyPayers || [],
            networks_by_payer: networksByPayer,
            providers_with_no_networks: providersWithNoNetworks,
            specific_issues: {
                molina_utah: {
                    payer_id: '8b48c3e2-f555-4d67-8122-c086466ba97d',
                    networks: networksByPayer['Molina Utah'] || []
                },
                uuhp: {
                    networks_found: Object.keys(networksByPayer).filter(name => 
                        name.toLowerCase().includes('utah health plans') || 
                        name.toLowerCase().includes('uuhp')
                    )
                }
            }
        }

        console.log(`✅ Network analysis complete: ${totalProviders} providers, ${totalNetworks} networks`)
        
        return NextResponse.json(response)

    } catch (error: any) {
        console.error('💥 Network analysis error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
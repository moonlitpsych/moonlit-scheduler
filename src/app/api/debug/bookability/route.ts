// Debug endpoint for bookability explainability
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const providerId = searchParams.get('providerId')
        const payerId = searchParams.get('payerId')

        if (!providerId || !payerId) {
            return NextResponse.json({
                error: 'Both providerId and payerId are required',
                usage: 'GET /api/debug/bookability?providerId=<id>&payerId=<id>'
            }, { status: 400 })
        }

        console.log('🔍 Debugging bookability for:', { providerId, payerId })

        // Get provider details
        const { data: provider, error: providerError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_active, is_bookable')
            .eq('id', providerId)
            .single()

        if (providerError || !provider) {
            return NextResponse.json({
                error: 'Provider not found',
                providerId,
                details: providerError
            }, { status: 404 })
        }

        // Get payer details
        const { data: payer, error: payerError } = await supabaseAdmin
            .from('payers')
            .select('id, name, payer_type, state')
            .eq('id', payerId)
            .single()

        if (payerError || !payer) {
            return NextResponse.json({
                error: 'Payer not found',
                payerId,
                details: payerError
            }, { status: 404 })
        }

        // Check canonical bookable view for this specific combination
        const { data: bookableData, error: bookableError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .eq('provider_id', providerId)
            .eq('payer_id', payerId)

        // Get contract details
        const { data: contracts, error: contractError } = await supabaseAdmin
            .from('provider_payer_contracts')
            .select(`
                id,
                effective_start_date,
                effective_end_date,
                network_status,
                is_active,
                contract_type,
                billing_provider_id
            `)
            .eq('provider_id', providerId)
            .eq('payer_id', payerId)

        // Get supervision details if applicable
        const { data: supervisionData, error: supervisionError } = await supabaseAdmin
            .from('provider_supervisions')
            .select(`
                id,
                supervising_provider_id,
                supervised_provider_id,
                effective_start_date,
                effective_end_date,
                supervision_level,
                is_active,
                supervising_provider:providers!supervising_provider_id(first_name, last_name)
            `)
            .eq('supervised_provider_id', providerId)
            .eq('is_active', true)

        // Build explainability response
        const explanation = {
            provider: {
                id: provider.id,
                name: `${provider.first_name} ${provider.last_name}`,
                is_active: provider.is_active,
                is_bookable: provider.is_bookable
            },
            payer: {
                id: payer.id,
                name: payer.name,
                payer_type: payer.payer_type,
                state: payer.state
            },
            bookability_status: {
                is_bookable: (bookableData && bookableData.length > 0),
                total_bookable_relationships: bookableData?.length || 0
            },
            detailed_analysis: {
                provider_prerequisites: {
                    provider_exists: !!provider,
                    provider_active: provider.is_active,
                    provider_bookable: provider.is_bookable,
                    meets_basic_requirements: provider.is_active && provider.is_bookable
                },
                payer_prerequisites: {
                    payer_exists: !!payer,
                    payer_valid: !!payer.name,
                    meets_basic_requirements: !!payer.name
                },
                contract_analysis: {
                    contracts_found: contracts?.length || 0,
                    active_contracts: contracts?.filter(c => c.is_active).length || 0,
                    contract_details: contracts?.map(contract => {
                        const now = new Date()
                        const startDate = new Date(contract.effective_start_date)
                        const endDate = contract.effective_end_date ? new Date(contract.effective_end_date) : null
                        
                        const isCurrentlyEffective = startDate <= now && (!endDate || endDate >= now)
                        
                        return {
                            id: contract.id,
                            type: contract.contract_type,
                            network_status: contract.network_status,
                            is_active: contract.is_active,
                            effective_period: {
                                start: contract.effective_start_date,
                                end: contract.effective_end_date || 'ongoing',
                                is_currently_effective: isCurrentlyEffective
                            },
                            billing_provider_id: contract.billing_provider_id,
                            contributes_to_bookability: contract.is_active && isCurrentlyEffective
                        }
                    }) || []
                },
                supervision_analysis: {
                    supervision_relationships: supervisionData?.length || 0,
                    active_supervisors: supervisionData?.filter(s => s.is_active).length || 0,
                    supervision_details: supervisionData?.map(supervision => {
                        const now = new Date()
                        const startDate = new Date(supervision.effective_start_date)
                        const endDate = supervision.effective_end_date ? new Date(supervision.effective_end_date) : null
                        
                        const isCurrentlyEffective = startDate <= now && (!endDate || endDate >= now)
                        
                        return {
                            id: supervision.id,
                            supervising_provider: supervision.supervising_provider ? 
                                `${supervision.supervising_provider.first_name} ${supervision.supervising_provider.last_name}` : 
                                'Unknown',
                            supervising_provider_id: supervision.supervising_provider_id,
                            supervision_level: supervision.supervision_level,
                            is_active: supervision.is_active,
                            effective_period: {
                                start: supervision.effective_start_date,
                                end: supervision.effective_end_date || 'ongoing',
                                is_currently_effective: isCurrentlyEffective
                            },
                            contributes_to_bookability: supervision.is_active && isCurrentlyEffective
                        }
                    }) || []
                }
            },
            canonical_view_data: bookableData?.map(bd => ({
                provider_id: bd.provider_id,
                payer_id: bd.payer_id,
                network_status: bd.network_status,
                billing_provider_id: bd.billing_provider_id,
                effective_date: bd.effective_date,
                bookable_from_date: bd.bookable_from_date,
                supervision_level: bd.supervision_level
            })) || [],
            recommendation: generateBookabilityRecommendation(
                provider,
                payer,
                contracts || [],
                supervisionData || [],
                bookableData || []
            )
        }

        return NextResponse.json({
            success: true,
            explanation,
            debug_info: {
                timestamp: new Date().toISOString(),
                canonical_view_used: 'v_bookable_provider_payer',
                query_errors: {
                    provider_error: providerError,
                    payer_error: payerError,
                    bookable_error: bookableError,
                    contract_error: contractError,
                    supervision_error: supervisionError
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Bookability debug error:', error)
        return NextResponse.json({
            success: false,
            error: 'Debug endpoint failed',
            details: error.message
        }, { status: 500 })
    }
}

function generateBookabilityRecommendation(
    provider: any,
    payer: any,
    contracts: any[],
    supervisions: any[],
    bookableData: any[]
): string {
    if (!provider.is_active) {
        return "❌ Provider is not active. Activate the provider to enable bookability."
    }
    
    if (!provider.is_bookable) {
        return "❌ Provider is marked as not bookable. Update provider settings to enable booking."
    }
    
    if (!payer.name) {
        return "❌ Payer data is incomplete. Check payer configuration."
    }
    
    if (bookableData.length === 0) {
        const activeContracts = contracts.filter(c => c.is_active)
        
        if (activeContracts.length === 0) {
            return "❌ No active contracts found between provider and payer. Create an active contract to enable bookability."
        }
        
        const currentContracts = activeContracts.filter(c => {
            const now = new Date()
            const start = new Date(c.effective_start_date)
            const end = c.effective_end_date ? new Date(c.effective_end_date) : null
            return start <= now && (!end || end >= now)
        })
        
        if (currentContracts.length === 0) {
            return "❌ Contracts exist but none are currently effective. Check contract dates and extend or create new contracts."
        }
        
        return "❌ Contracts appear valid but not showing in canonical view. Check view logic or contact system administrator."
    }
    
    const directRelationships = bookableData.filter(bd => bd.network_status === 'in_network')
    const supervisedRelationships = bookableData.filter(bd => bd.network_status === 'supervised')
    
    if (directRelationships.length > 0) {
        return `✅ Provider is directly bookable with this payer (${directRelationships.length} direct relationship${directRelationships.length > 1 ? 's' : ''}).`
    }
    
    if (supervisedRelationships.length > 0) {
        return `✅ Provider is bookable under supervision with this payer (${supervisedRelationships.length} supervised relationship${supervisedRelationships.length > 1 ? 's' : ''}).`
    }
    
    return "✅ Provider appears bookable with this payer through the canonical view."
}
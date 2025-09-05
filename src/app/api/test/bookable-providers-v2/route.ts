// Test endpoint for new bookable_provider_payers_v2 view
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payer_id = searchParams.get('payer_id')
        const limit = parseInt(searchParams.get('limit') || '10')

        console.log('🧪 Testing bookable_provider_payers_v2 view:', { payer_id, limit })

        // Test query without payer filter first
        const { data: allBookable, error: allError } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*')
            .limit(limit)

        if (allError) {
            console.error('❌ Error querying view (all):', allError)
            return NextResponse.json({
                success: false,
                error: 'Failed to query bookable_provider_payers_v2 view',
                details: allError,
                sql_hint: 'Make sure the view exists and has proper permissions'
            }, { status: 500 })
        }

        let payerSpecific = null
        if (payer_id) {
            const { data: payerData, error: payerError } = await supabaseAdmin
                .from('bookable_provider_payers_v2')
                .select('*')
                .eq('payer_id', payer_id)
                .limit(limit)

            if (payerError) {
                console.error('❌ Error querying view (payer-specific):', payerError)
            } else {
                payerSpecific = payerData
            }
        }

        // Analyze the results
        const directCount = allBookable?.filter(bp => bp.via === 'direct').length || 0
        const supervisedCount = allBookable?.filter(bp => bp.via === 'supervised').length || 0
        const coVisitCount = allBookable?.filter(bp => bp.requires_co_visit).length || 0

        const response = {
            success: true,
            view_test_results: {
                total_bookable_relationships: allBookable?.length || 0,
                direct_relationships: directCount,
                supervised_relationships: supervisedCount,
                co_visit_required_relationships: coVisitCount,
                sample_data: allBookable?.slice(0, 3).map(bp => ({
                    provider_name: `${bp.first_name} ${bp.last_name}`,
                    provider_id: bp.provider_id,
                    payer_id: bp.payer_id,
                    via: bp.via,
                    requires_co_visit: bp.requires_co_visit,
                    attending_provider_id: bp.attending_provider_id,
                    supervision_level: bp.supervision_level,
                    effective: bp.effective,
                    bookable_from_date: bp.bookable_from_date
                })),
                ...(payerSpecific && {
                    payer_specific_results: {
                        payer_id,
                        total_providers: payerSpecific.length,
                        direct: payerSpecific.filter(bp => bp.via === 'direct').length,
                        supervised: payerSpecific.filter(bp => bp.via === 'supervised').length,
                        providers: payerSpecific.map(bp => `${bp.first_name} ${bp.last_name} (${bp.via})`)
                    }
                })
            },
            raw_data: {
                all_bookable: allBookable,
                payer_specific: payerSpecific
            }
        }

        console.log('✅ View test completed:', {
            total: allBookable?.length,
            direct: directCount,
            supervised: supervisedCount,
            co_visit: coVisitCount
        })

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('❌ Test endpoint error:', error)
        return NextResponse.json({
            success: false,
            error: 'Test endpoint failed',
            details: error.message,
            hint: 'Check if bookable_provider_payers_v2 view exists and is accessible'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { payer_id, test_co_visit = false } = body

        console.log('🧪 POST test for bookable providers:', { payer_id, test_co_visit })

        if (!payer_id) {
            return NextResponse.json({
                success: false,
                error: 'payer_id is required for POST test'
            }, { status: 400 })
        }

        // Test the same query pattern used by the actual APIs
        const { data: bookableProviders, error } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select(`
                provider_id,
                payer_id,
                via,
                attending_provider_id,
                supervision_level,
                requires_co_visit,
                effective,
                bookable_from_date,
                first_name,
                last_name,
                title,
                role,
                provider_type,
                is_active,
                is_bookable
            `)
            .eq('payer_id', payer_id)

        if (error) {
            return NextResponse.json({
                success: false,
                error: 'Query failed',
                details: error,
                api_compatibility: 'FAILED - APIs will not work with this view'
            }, { status: 500 })
        }

        const compatibilityTest = {
            api_compatibility: 'PASSED - APIs should work correctly',
            provider_count: bookableProviders?.length || 0,
            has_required_fields: {
                provider_id: bookableProviders?.[0]?.provider_id ? true : false,
                via: bookableProviders?.[0]?.via ? true : false,
                requires_co_visit: typeof bookableProviders?.[0]?.requires_co_visit === 'boolean',
                provider_details: bookableProviders?.[0]?.first_name ? true : false
            },
            supervision_analysis: {
                total: bookableProviders?.length || 0,
                direct: bookableProviders?.filter(bp => bp.via === 'direct').length || 0,
                supervised: bookableProviders?.filter(bp => bp.via === 'supervised').length || 0,
                co_visit_required: bookableProviders?.filter(bp => bp.requires_co_visit).length || 0
            },
            sample_provider: bookableProviders?.[0] ? {
                name: `${bookableProviders[0].first_name} ${bookableProviders[0].last_name}`,
                via: bookableProviders[0].via,
                requires_co_visit: bookableProviders[0].requires_co_visit,
                attending_provider_id: bookableProviders[0].attending_provider_id,
                supervision_level: bookableProviders[0].supervision_level
            } : null
        }

        return NextResponse.json({
            success: true,
            test_results: compatibilityTest,
            raw_data: bookableProviders
        })

    } catch (error: any) {
        console.error('❌ POST test error:', error)
        return NextResponse.json({
            success: false,
            error: 'POST test failed',
            details: error.message
        }, { status: 500 })
    }
}
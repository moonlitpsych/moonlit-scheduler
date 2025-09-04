// Debug endpoint to verify new database structure from ChatGPT updates

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Verifying new database structure...')

        const results = {
            views: {},
            functions: {},
            materializedView: {},
            qa_checks: {},
            errors: []
        }

        // A. Check if MV is healthy & populated
        try {
            const { data: mvCheck, error: mvError } = await supabaseAdmin
                .rpc('bookable_provider_payers_v2')
                .select('via')

            if (mvError) {
                results.errors.push(`MV check error: ${mvError.message}`)
            } else {
                // Group by via to see distribution
                const viaCounts = mvCheck?.reduce((acc: any, row: any) => {
                    acc[row.via] = (acc[row.via] || 0) + 1
                    return acc
                }, {}) || {}
                results.materializedView = { via_distribution: viaCounts, total_rows: mvCheck?.length || 0 }
            }
        } catch (error: any) {
            results.errors.push(`MV access error: ${error.message}`)
        }

        // B. Test list_bookable_slots_for_payer function
        try {
            const testPayerId = 'a01d69d6-ae70-4917-afef-49b5ef7e5220' // Utah Medicaid
            const testServiceId = 'ac8a10fa-443e-4913-93d3-26c0307beb96'
            const fromDate = new Date().toISOString().split('T')[0]
            const thruDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            const { data: slotsData, error: slotsError } = await supabaseAdmin
                .rpc('list_bookable_slots_for_payer', {
                    p_payer_id: testPayerId,
                    p_service_instance_id: testServiceId,
                    p_from: fromDate,
                    p_thru: thruDate,
                    p_tz: 'America/Denver'
                })

            if (slotsError) {
                results.errors.push(`Slots function error: ${slotsError.message}`)
            } else {
                results.functions.list_bookable_slots = {
                    test_parameters: { testPayerId, testServiceId, fromDate, thruDate },
                    result_count: slotsData?.length || 0,
                    sample_results: slotsData?.slice(0, 3) || []
                }
            }
        } catch (error: any) {
            results.errors.push(`Slots function test error: ${error.message}`)
        }

        // C. Check bookable_provider_payers_v2 view directly
        try {
            const { data: bppData, error: bppError } = await supabaseAdmin
                .from('bookable_provider_payers_v2')
                .select('provider_id, payer_id, via, supervision_level, requires_co_visit')
                .limit(5)

            if (bppError) {
                results.errors.push(`BPP v2 view error: ${bppError.message}`)
            } else {
                results.views.bookable_provider_payers_v2 = {
                    accessible: true,
                    sample_rows: bppData?.length || 0,
                    sample_data: bppData || []
                }
            }
        } catch (error: any) {
            results.errors.push(`BPP v2 view access error: ${error.message}`)
        }

        // D. Check existing provider-payer networks for comparison
        try {
            const { data: legacyData, error: legacyError } = await supabaseAdmin
                .from('provider_payer_networks')
                .select('provider_id, payer_id')
                .limit(5)

            if (legacyError) {
                results.errors.push(`Legacy PPN error: ${legacyError.message}`)
            } else {
                results.views.legacy_provider_payer_networks = {
                    accessible: true,
                    sample_rows: legacyData?.length || 0,
                    sample_data: legacyData || []
                }
            }
        } catch (error: any) {
            results.errors.push(`Legacy PPN access error: ${error.message}`)
        }

        return NextResponse.json({
            success: true,
            message: 'Database structure verification complete',
            results,
            recommendations: results.errors.length === 0 
                ? ['All new database structures appear to be working!']
                : ['Some database structures may not be deployed yet', 'Check deployment status']
        })

    } catch (error: any) {
        console.error('❌ Database verification error:', error)
        return NextResponse.json(
            { success: false, error: 'Database verification failed', details: error.message },
            { status: 500 }
        )
    }
}
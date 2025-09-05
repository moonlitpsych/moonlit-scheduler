// Test the list_bookable_slots_for_payer function directly

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payerId = searchParams.get('payer_id') || 'a01d69d6-ae70-4917-afef-49b5ef7e5220' // Utah Medicaid
        const serviceId = searchParams.get('service_id') || 'ac8a10fa-443e-4913-93d3-26c0307beb96'
        
        console.log('🧪 Testing list_bookable_slots_for_payer function...')

        const fromDate = new Date().toISOString().split('T')[0]
        const thruDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const results = {
            test_parameters: { payerId, serviceId, fromDate, thruDate },
            function_test: null,
            alternative_availability_test: null
        }

        // Test the new function
        try {
            console.log('📡 Testing list_bookable_slots_for_payer function...')
            const { data: slotsData, error: slotsError } = await supabaseAdmin
                .rpc('list_bookable_slots_for_payer', {
                    p_payer_id: payerId,
                    p_service_instance_id: serviceId,
                    p_from: fromDate,
                    p_thru: thruDate,
                    p_tz: 'America/Denver'
                })

            if (slotsError) {
                results.function_test = { error: slotsError.message, function_exists: false }
            } else {
                results.function_test = {
                    function_exists: true,
                    result_count: slotsData?.length || 0,
                    sample_results: slotsData?.slice(0, 3) || [],
                    all_results: slotsData || []
                }
            }
        } catch (error: any) {
            results.function_test = { error: error.message, function_exists: false }
        }

        // Test alternative: check if we have provider availability cache data
        try {
            console.log('📊 Testing provider_availability_cache...')
            const { data: cacheData, error: cacheError } = await supabaseAdmin
                .from('provider_availability_cache')
                .select('*')
                .gte('date', fromDate)
                .lte('date', thruDate)
                .limit(5)

            if (cacheError) {
                results.alternative_availability_test = { error: cacheError.message }
            } else {
                results.alternative_availability_test = {
                    cache_rows_found: cacheData?.length || 0,
                    sample_cache_data: cacheData || []
                }
            }
        } catch (error: any) {
            results.alternative_availability_test = { error: error.message }
        }

        return NextResponse.json({
            success: true,
            message: 'Slot function testing complete',
            results,
            analysis: {
                function_deployed: results.function_test?.function_exists || false,
                has_availability_data: (results.alternative_availability_test?.cache_rows_found || 0) > 0,
                recommendation: results.function_test?.function_exists 
                    ? 'Use list_bookable_slots_for_payer for slot generation'
                    : 'Function not deployed - continue using current availability system'
            }
        })

    } catch (error: any) {
        console.error('❌ Slot function test error:', error)
        return NextResponse.json(
            { success: false, error: 'Test failed', details: error.message },
            { status: 500 }
        )
    }
}
// Detailed test of list_bookable_slots_for_payer function with parameter debugging

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payerId = searchParams.get('payer_id') || 'a01d69d6-ae70-4917-afef-49b5ef7e5220' // Utah Medicaid
        const serviceId = searchParams.get('service_id') || 'ac8a10fa-443e-4913-93d3-26c0307beb96'
        
        console.log('🔍 Detailed slot function testing...')

        const fromDate = new Date().toISOString().split('T')[0]
        const thruDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const results = {
            test_parameters: { payerId, serviceId, fromDate, thruDate },
            cache_verification: null,
            function_test_detailed: null,
            parameter_variations: []
        }

        // 1. Verify cache data for this date range
        console.log('📊 Verifying cache data...')
        const { data: cacheData, error: cacheError } = await supabaseAdmin
            .from('provider_availability_cache')
            .select('*')
            .eq('service_instance_id', serviceId)
            .gte('date', fromDate)
            .lte('date', thruDate)

        if (cacheError) {
            results.cache_verification = { error: cacheError.message }
        } else {
            results.cache_verification = {
                matching_records: cacheData?.length || 0,
                providers_with_data: [...new Set(cacheData?.map(c => c.provider_id) || [])],
                dates_with_data: [...new Set(cacheData?.map(c => c.date) || [])].sort(),
                sample_slots_count: cacheData?.[0]?.available_slots?.length || 0
            }
        }

        // 2. Test function with detailed logging
        console.log('📡 Testing function with detailed parameters...')
        const functionParams = {
            p_payer_id: payerId,
            p_service_instance_id: serviceId, 
            p_from: fromDate,
            p_thru: thruDate,
            p_tz: 'America/Denver'
        }

        console.log('🎯 Function call parameters:', functionParams)

        const { data: slotsData, error: slotsError } = await supabaseAdmin
            .rpc('list_bookable_slots_for_payer', functionParams)

        if (slotsError) {
            results.function_test_detailed = { error: slotsError.message, params: functionParams }
        } else {
            results.function_test_detailed = {
                result_count: slotsData?.length || 0,
                sample_results: slotsData?.slice(0, 5) || [],
                params_used: functionParams,
                all_results: slotsData || []
            }
        }

        // 3. Test with parameter variations
        const variations = [
            { name: 'Without timezone', params: { p_payer_id: payerId, p_service_instance_id: serviceId, p_from: fromDate, p_thru: thruDate } },
            { name: 'Single day', params: { p_payer_id: payerId, p_service_instance_id: serviceId, p_from: fromDate, p_thru: fromDate, p_tz: 'America/Denver' } },
            { name: 'Extended range', params: { p_payer_id: payerId, p_service_instance_id: serviceId, p_from: fromDate, p_thru: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], p_tz: 'America/Denver' } }
        ]

        for (const variation of variations) {
            console.log(`🧪 Testing variation: ${variation.name}`)
            try {
                const { data: varData, error: varError } = await supabaseAdmin
                    .rpc('list_bookable_slots_for_payer', variation.params)
                
                results.parameter_variations.push({
                    name: variation.name,
                    params: variation.params,
                    success: !varError,
                    result_count: varData?.length || 0,
                    error: varError?.message || null,
                    sample_result: varData?.[0] || null
                })
            } catch (error: any) {
                results.parameter_variations.push({
                    name: variation.name,
                    params: variation.params,
                    success: false,
                    error: error.message
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Detailed slot function testing complete',
            results,
            diagnosis: {
                cache_populated: (results.cache_verification?.matching_records || 0) > 0,
                function_callable: results.function_test_detailed?.error === undefined,
                slots_generated: (results.function_test_detailed?.result_count || 0) > 0,
                issue_likely: results.cache_verification?.matching_records > 0 && results.function_test_detailed?.result_count === 0 ? 
                    "Function exists and cache has data but no slots returned - likely function logic issue" : 
                    "Unknown issue"
            }
        })

    } catch (error: any) {
        console.error('❌ Detailed slot function test error:', error)
        return NextResponse.json(
            { success: false, error: 'Detailed test failed', details: error.message },
            { status: 500 }
        )
    }
}
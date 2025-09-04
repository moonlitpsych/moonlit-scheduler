// Test direct availability cache access as alternative to list_bookable_slots_for_payer

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { payer_id, date, service_id } = await request.json()
        
        const payerId = payer_id || 'a01d69d6-ae70-4917-afef-49b5ef7e5220'
        const serviceId = service_id || 'ac8a10fa-443e-4913-93d3-26c0307beb96'
        const targetDate = date || new Date().toISOString().split('T')[0]
        
        console.log('🧪 Testing direct cache availability access...')

        const results = {
            test_parameters: { payerId, serviceId, targetDate },
            step1_get_bookable_providers: null,
            step2_get_cache_availability: null,
            step3_generate_slots: null
        }

        // Step 1: Get bookable providers (using fallback logic like providers-for-payer API)
        console.log('👥 Step 1: Getting bookable providers...')
        const { data: directNetworks, error: networkError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select('provider_id, payer_id')
            .eq('payer_id', payerId)
            .eq('status', 'in_network')

        if (networkError) {
            results.step1_get_bookable_providers = { error: networkError.message }
        } else {
            const providerIds = [...new Set(directNetworks.map(n => n.provider_id))]
            
            // Get provider details
            const { data: providers, error: provError } = await supabaseAdmin
                .from('providers')
                .select('id, first_name, last_name, is_bookable')
                .in('id', providerIds)
                .eq('is_bookable', true)

            if (provError) {
                results.step1_get_bookable_providers = { error: provError.message }
            } else {
                results.step1_get_bookable_providers = {
                    total_networks: directNetworks.length,
                    bookable_providers: providers.length,
                    provider_details: providers.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))
                }
                
                // Step 2: Get availability cache data for these providers
                console.log('📊 Step 2: Getting cache availability...')
                const bookableProviderIds = providers.map(p => p.id)
                
                const { data: cacheData, error: cacheError } = await supabaseAdmin
                    .from('provider_availability_cache')
                    .select('*')
                    .in('provider_id', bookableProviderIds)
                    .eq('service_instance_id', serviceId)
                    .eq('date', targetDate)

                if (cacheError) {
                    results.step2_get_cache_availability = { error: cacheError.message }
                } else {
                    results.step2_get_cache_availability = {
                        cache_records_found: cacheData.length,
                        providers_with_cache: [...new Set(cacheData.map(c => c.provider_id))],
                        total_slots: cacheData.reduce((sum, record) => sum + (record.available_slots?.length || 0), 0)
                    }

                    // Step 3: Generate bookable slots
                    console.log('🎯 Step 3: Generating bookable slots...')
                    const bookableSlots = []
                    
                    for (const cacheRecord of cacheData) {
                        const provider = providers.find(p => p.id === cacheRecord.provider_id)
                        if (!provider) continue

                        for (const slot of cacheRecord.available_slots || []) {
                            if (slot.available) {
                                bookableSlots.push({
                                    provider_id: provider.id,
                                    provider_name: `${provider.first_name} ${provider.last_name}`,
                                    start_time: slot.start_time,
                                    end_time: slot.end_time,
                                    duration_minutes: slot.duration_minutes,
                                    appointment_type: slot.appointment_type,
                                    date: targetDate
                                })
                            }
                        }
                    }

                    results.step3_generate_slots = {
                        total_bookable_slots: bookableSlots.length,
                        sample_slots: bookableSlots.slice(0, 5),
                        all_slots: bookableSlots
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Direct cache availability test complete',
            results,
            conclusion: {
                cache_approach_works: (results.step3_generate_slots?.total_bookable_slots || 0) > 0,
                slots_generated: results.step3_generate_slots?.total_bookable_slots || 0,
                next_steps: results.step3_generate_slots?.total_bookable_slots > 0 ? 
                    ["Direct cache access works - could replace list_bookable_slots_for_payer function", "Update merged-availability API to use this approach"] :
                    ["No slots generated - investigate cache data or provider relationships"]
            }
        })

    } catch (error: any) {
        console.error('❌ Direct cache availability test error:', error)
        return NextResponse.json(
            { success: false, error: 'Direct cache test failed', details: error.message },
            { status: 500 }
        )
    }
}
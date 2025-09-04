// Hybrid slots API following ChatGPT's plan: Primary function + Safe fallback
// Implements the exact UX flow: Payer → Visit Type → Calendar → Slot Selection

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface SlotResponse {
    provider_id: string
    attending_provider_id?: string | null
    payer_id: string
    service_instance_id: string
    via: 'direct' | 'supervised'
    supervision_level: 'none' | 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required'
    requires_co_visit: boolean
    date: string
    slots: Array<{
        start: string  // ISO-8601
        end: string    // ISO-8601
    }>
}

export async function POST(request: NextRequest) {
    try {
        const { payer_id, service_instance_id, from_date, thru_date, tz = 'America/Denver' } = await request.json()

        if (!payer_id || !service_instance_id || !from_date || !thru_date) {
            return NextResponse.json(
                { success: false, error: 'payer_id, service_instance_id, from_date, and thru_date are required' },
                { status: 400 }
            )
        }

        console.log('🎯 Getting slots for payer using ChatGPT hybrid approach:', { 
            payer_id, service_instance_id, from_date, thru_date, tz 
        })

        const results = {
            primary_function_result: null,
            fallback_result: null,
            method_used: null,
            slots: []
        }

        // Step 1: PRIMARY - Call list_bookable_slots_for_payer function
        console.log('📡 PRIMARY: Calling list_bookable_slots_for_payer function...')
        const functionParams = {
            p_payer_id: payer_id,
            p_service_instance_id: service_instance_id,
            p_from: from_date,
            p_thru: thru_date,
            p_tz: tz
        }

        const { data: functionSlots, error: functionError } = await supabaseAdmin
            .rpc('list_bookable_slots_for_payer', functionParams)

        if (functionError) {
            console.error('❌ Function call error:', functionError)
            results.primary_function_result = { error: functionError.message }
        } else {
            results.primary_function_result = { 
                success: true, 
                result_count: functionSlots?.length || 0,
                slots: functionSlots || []
            }
            
            if (functionSlots && functionSlots.length > 0) {
                console.log(`✅ PRIMARY SUCCESS: Function returned ${functionSlots.length} slot groups`)
                results.method_used = 'primary_function'
                results.slots = functionSlots
                
                return NextResponse.json({
                    success: true,
                    data: {
                        method: 'primary_function',
                        slots: results.slots,
                        total_slot_groups: results.slots.length,
                        date_range: { from_date, thru_date }
                    }
                })
            }
        }

        // Step 2: SAFE FALLBACK - Use direct cache approach with business rules
        console.log('🔄 FALLBACK: Function returned 0 results, using direct cache approach...')
        
        // 2a: Verify service still has cache in date window (as ChatGPT recommended)
        const { data: cacheCheck, error: cacheCheckError } = await supabaseAdmin
            .from('provider_availability_cache')
            .select('provider_id, date', { count: 'exact' })
            .eq('service_instance_id', service_instance_id)
            .gte('date', from_date)
            .lte('date', thru_date)

        if (cacheCheckError || !cacheCheck || cacheCheck.length === 0) {
            console.log('❌ FALLBACK: No cache data found for service in date window')
            results.fallback_result = { error: 'No cache data available' }
            
            return NextResponse.json({
                success: true,
                data: {
                    method: 'no_availability',
                    slots: [],
                    total_slot_groups: 0,
                    message: 'No times available for this visit type in the selected dates',
                    date_range: { from_date, thru_date }
                }
            })
        }

        console.log(`📊 FALLBACK: Cache verification passed - ${cacheCheck.length} records found`)

        // 2b: Get bookable providers from bookable_provider_payers_v2 for date window 
        // (but use legacy fallback due to daterange parsing issues)
        console.log('👥 FALLBACK: Getting bookable provider relationships...')
        const { data: providerNetworks, error: networksError } = await supabaseAdmin
            .from('provider_payer_networks')
            .select('provider_id, payer_id')
            .eq('payer_id', payer_id)
            .eq('status', 'in_network')

        if (networksError || !providerNetworks || providerNetworks.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    method: 'no_providers',
                    slots: [],
                    total_slot_groups: 0,
                    message: 'No providers accept this insurance',
                    date_range: { from_date, thru_date }
                }
            })
        }

        const networkProviderIds = providerNetworks.map(n => n.provider_id)

        // 2c: Get provider details for bookable providers
        const { data: providers, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_bookable')
            .in('id', networkProviderIds)
            .eq('is_bookable', true)

        if (providersError || !providers || providers.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    method: 'no_bookable_providers',
                    slots: [],
                    total_slot_groups: 0,
                    message: 'No bookable providers available',
                    date_range: { from_date, thru_date }
                }
            })
        }

        const bookableProviderIds = providers.map(p => p.id)
        console.log(`👥 FALLBACK: Found ${bookableProviderIds.length} bookable providers`)

        // 2d: Get availability cache for bookable providers in date range
        const { data: cacheData, error: cacheError } = await supabaseAdmin
            .from('provider_availability_cache')
            .select('*')
            .eq('service_instance_id', service_instance_id)
            .in('provider_id', bookableProviderIds)
            .gte('date', from_date)
            .lte('date', thru_date)
            .order('date', { ascending: true })
            .order('provider_id', { ascending: true })

        if (cacheError || !cacheData || cacheData.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    method: 'no_cache_data',
                    slots: [],
                    total_slot_groups: 0,
                    message: 'No availability data found',
                    date_range: { from_date, thru_date }
                }
            })
        }

        // 2e: Transform cache data to match exact ChatGPT response format
        const slotGroups: SlotResponse[] = []
        
        for (const cacheRecord of cacheData) {
            const provider = providers.find(p => p.id === cacheRecord.provider_id)
            if (!provider || !cacheRecord.available_slots) continue

            // Transform available slots to ChatGPT format
            const slots = cacheRecord.available_slots
                .filter((slot: any) => slot.available)
                .map((slot: any) => ({
                    start: new Date(`${cacheRecord.date}T${slot.start_time.split(' ')[1]}${tz === 'America/Denver' ? '-07:00' : 'Z'}`).toISOString(),
                    end: new Date(`${cacheRecord.date}T${slot.end_time.split(' ')[1]}${tz === 'America/Denver' ? '-07:00' : 'Z'}`).toISOString()
                }))

            if (slots.length > 0) {
                slotGroups.push({
                    provider_id: cacheRecord.provider_id,
                    attending_provider_id: null, // For direct relationships
                    payer_id: payer_id,
                    service_instance_id: service_instance_id,
                    via: 'direct', // Legacy networks are all direct
                    supervision_level: 'none',
                    requires_co_visit: false,
                    date: cacheRecord.date,
                    slots: slots
                })
            }
        }

        results.fallback_result = {
            success: true,
            cache_records: cacheData.length,
            slot_groups: slotGroups.length,
            total_individual_slots: slotGroups.reduce((sum, group) => sum + group.slots.length, 0)
        }
        results.method_used = 'safe_fallback'
        results.slots = slotGroups

        console.log(`✅ FALLBACK SUCCESS: Generated ${slotGroups.length} slot groups with ${results.fallback_result.total_individual_slots} individual slots`)

        return NextResponse.json({
            success: true,
            data: {
                method: 'safe_fallback',
                slots: results.slots,
                total_slot_groups: results.slots.length,
                total_individual_slots: results.fallback_result.total_individual_slots,
                date_range: { from_date, thru_date },
                debug: {
                    primary_function_attempted: true,
                    primary_function_result: results.primary_function_result,
                    fallback_used: true,
                    cache_records_found: results.fallback_result.cache_records
                }
            }
        })

    } catch (error: any) {
        console.error('❌ Hybrid slots API error:', error)
        return NextResponse.json(
            { success: false, error: 'Slot generation failed', details: error.message },
            { status: 500 }
        )
    }
}
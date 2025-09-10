// Test endpoint to verify new booking slot logic with available database functions

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const payerId = searchParams.get('payer_id') || 'a01d69d6-ae70-4917-afef-49b5ef7e5220' // Utah Medicaid
        const serviceId = searchParams.get('service_id') || 'ac8a10fa-443e-4913-93d3-26c0307beb96'
        
        console.log('🧪 Testing new slot booking logic...')

        const results = {
            step1_get_bookable_relationships: null,
            step2_get_provider_info: null,
            step3_simulate_slot_generation: null,
            step4_appointment_creation_logic: null,
            current_vs_new_comparison: null
        }

        // Step 1: Get bookable relationships from new view
        const { data: relationships, error: relError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .eq('payer_id', payerId)

        if (relError) {
            results.step1_get_bookable_relationships = { error: relError.message }
        } else {
            results.step1_get_bookable_relationships = {
                total_relationships: relationships?.length || 0,
                direct_count: relationships?.filter(r => r.via === 'direct').length || 0,
                supervised_count: relationships?.filter(r => r.via === 'supervised').length || 0,
                co_visit_required: relationships?.filter(r => r.requires_co_visit).length || 0,
                sample_relationships: relationships?.slice(0, 3) || []
            }
        }

        // Step 2: Get provider info for the relationships
        if (relationships && relationships.length > 0) {
            const providerIds = [...new Set(relationships.map(r => r.provider_id))]
            
            const { data: providers, error: provError } = await supabaseAdmin
                .from('providers')
                .select('id, first_name, last_name, title, role, is_bookable, languages_spoken')
                .in('id', providerIds)

            if (provError) {
                results.step2_get_provider_info = { error: provError.message }
            } else {
                results.step2_get_provider_info = {
                    providers_found: providers?.length || 0,
                    providers: providers || []
                }
            }
        }

        // Step 3: Simulate new vs old appointment creation logic
        results.step4_appointment_creation_logic = {
            old_pattern: {
                description: "Currently we use: provider_id (who patient sees), rendering_provider_id (nullable)",
                example: "Direct: provider_id=resident, rendering_provider_id=null",
                example2: "Supervised: provider_id=resident, rendering_provider_id=attending"
            },
            new_pattern_recommended: {
                description: "New DB suggests: provider_id (who bills), rendering_provider_id (who provides service)",
                example: "Direct: provider_id=resident, rendering_provider_id=null", 
                example2: "Supervised billing: provider_id=attending, rendering_provider_id=resident"
            }
        }

        // Step 4: Compare current API vs new structure
        results.current_vs_new_comparison = {
            current_api_status: "providers-for-payer falls back to legacy due to missing first_name/last_name in v2 view",
            what_works: "v2 view has supervision relationships with via/supervision_level/requires_co_visit",
            what_missing: "list_bookable_slots_for_payer function returns 0 results",
            recommendation: "Update API to join v2 view with providers table for complete data"
        }

        return NextResponse.json({
            success: true,
            test_parameters: { payerId, serviceId },
            results,
            next_steps: [
                "1. Update providers-for-payer to join v2 view with providers table",
                "2. Check if list_bookable_slots_for_payer function is deployed correctly",
                "3. Update appointment creation to handle rendering_provider_id pattern",
                "4. Test supervision relationships with co-visit logic"
            ]
        })

    } catch (error: any) {
        console.error('❌ Slot logic test error:', error)
        return NextResponse.json(
            { success: false, error: 'Test failed', details: error.message },
            { status: 500 }
        )
    }
}
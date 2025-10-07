/**
 * Debug endpoint to check bookability discrepancy
 * Compares v_bookable_provider_payer vs bookable_provider_payers_v2
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const { provider_id, payer_id, date } = await request.json()

        if (!provider_id || !payer_id || !date) {
            return NextResponse.json({
                error: 'Missing required fields: provider_id, payer_id, date'
            }, { status: 400 })
        }

        console.log(`🔍 Checking bookability for provider ${provider_id} + payer ${payer_id} on ${date}`)

        // Check v_bookable_provider_payer (used by availability API)
        const { data: viewData, error: viewError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .eq('provider_id', provider_id)
            .eq('payer_id', payer_id)

        // Check bookable_provider_payers_v2 (used by trigger)
        const { data: v2Data, error: v2Error } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*')
            .eq('provider_id', provider_id)
            .eq('payer_id', payer_id)

        // Get provider info
        const { data: providerData } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_bookable, accepts_new_patients')
            .eq('id', provider_id)
            .single()

        // Get payer info
        const { data: payerData } = await supabaseAdmin
            .from('payers')
            .select('id, name, payer_type, state')
            .eq('id', payer_id)
            .single()

        return NextResponse.json({
            success: true,
            provider: providerData,
            payer: payerData,
            requestedDate: date,
            availability_view: {
                name: 'v_bookable_provider_payer',
                usedBy: 'merged-availability API',
                found: viewData && viewData.length > 0,
                count: viewData?.length || 0,
                data: viewData || [],
                error: viewError?.message
            },
            trigger_view: {
                name: 'bookable_provider_payers_v2',
                usedBy: 'enforce_bookable_provider_payer() trigger',
                found: v2Data && v2Data.length > 0,
                count: v2Data?.length || 0,
                data: v2Data || [],
                error: v2Error?.message
            },
            diagnosis: {
                inAvailabilityView: viewData && viewData.length > 0,
                inTriggerView: v2Data && v2Data.length > 0,
                discrepancy: (viewData && viewData.length > 0) !== (v2Data && v2Data.length > 0),
                issue: (viewData && viewData.length > 0) && !(v2Data && v2Data.length > 0)
                    ? 'Provider-payer relationship exists in availability view but NOT in trigger view - this causes slots to show but booking to fail'
                    : null
            }
        })

    } catch (error: any) {
        console.error('❌ Error checking bookability:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

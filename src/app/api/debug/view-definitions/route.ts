/**
 * Debug endpoint to get view definitions
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all rows from bookable_provider_payers_v2
        const { data: v2Rows, error: v2Error } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*')
            .limit(100)

        // Get all rows from v_bookable_provider_payer for comparison
        const { data: viewRows, error: viewError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .limit(100)

        // Get provider-payer combinations that are in view but NOT in v2
        const viewProviderPayers = new Set(
            viewRows?.map(r => `${r.provider_id}::${r.payer_id}`) || []
        )
        const v2ProviderPayers = new Set(
            v2Rows?.map(r => `${r.provider_id}::${r.payer_id}`) || []
        )

        const inViewButNotV2 = viewRows?.filter(r =>
            !v2ProviderPayers.has(`${r.provider_id}::${r.payer_id}`)
        )

        const inV2ButNotView = v2Rows?.filter(r =>
            !viewProviderPayers.has(`${r.provider_id}::${r.payer_id}`)
        )

        return NextResponse.json({
            success: true,
            v_bookable_provider_payer: {
                count: viewRows?.length || 0,
                sample: viewRows?.slice(0, 5)
            },
            bookable_provider_payers_v2: {
                count: v2Rows?.length || 0,
                sample: v2Rows?.slice(0, 5)
            },
            discrepancies: {
                in_view_but_not_v2_count: inViewButNotV2?.length || 0,
                in_view_but_not_v2: inViewButNotV2?.slice(0, 10),
                in_v2_but_not_view_count: inV2ButNotView?.length || 0,
                in_v2_but_not_view: inV2ButNotView?.slice(0, 10)
            }
        })

    } catch (error: any) {
        console.error('❌ Error in view-definitions endpoint:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

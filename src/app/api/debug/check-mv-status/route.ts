/**
 * Debug endpoint to check materialized view status
 * Step 1: Prove/refresh MV
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const MOLINA_PAYER_ID = '8b48c3e2-f555-4d67-8122-c086466ba97d'

        // Count rows in bookable_provider_payers_v2 for Molina
        const { count: v2Count, error: v2Error } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*', { count: 'exact', head: true })
            .eq('payer_id', MOLINA_PAYER_ID)

        // Get sample rows for Molina
        const { data: v2Rows, error: v2RowsError } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('provider_id, payer_id, via, requires_co_visit, attending_provider_id, effective, bookable_from_date')
            .eq('payer_id', MOLINA_PAYER_ID)
            .limit(10)

        // Compare with v_bookable_provider_payer for same payer
        const { count: viewCount, error: viewError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*', { count: 'exact', head: true })
            .eq('payer_id', MOLINA_PAYER_ID)

        // Get sample from view
        const { data: viewRows, error: viewRowsError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('provider_id, payer_id, network_status, billing_provider_id, effective_date')
            .eq('payer_id', MOLINA_PAYER_ID)
            .limit(10)

        return NextResponse.json({
            success: true,
            payer: {
                id: MOLINA_PAYER_ID,
                name: 'Molina Utah'
            },
            bookable_provider_payers_v2: {
                count: v2Count,
                sample: v2Rows,
                error: v2Error?.message
            },
            v_bookable_provider_payer: {
                count: viewCount,
                sample: viewRows,
                error: viewError?.message
            },
            discrepancy: {
                exists: v2Count !== viewCount,
                difference: (viewCount || 0) - (v2Count || 0),
                message: v2Count === 0
                    ? '❌ CRITICAL: v2 has ZERO rows for Molina. Materialized view needs refresh!'
                    : (v2Count || 0) < (viewCount || 0)
                    ? `⚠️ WARNING: v2 has ${v2Count} rows but view has ${viewCount}. MV may be stale.`
                    : '✅ Row counts match or v2 has more rows'
            },
            next_steps: v2Count === 0 ? [
                'Run this SQL in Supabase SQL Editor:',
                'SELECT refresh_bookable_provider_payers_v2(false);',
                'OR:',
                'REFRESH MATERIALIZED VIEW bookable_provider_payers_v2_mv;'
            ] : null
        })

    } catch (error: any) {
        console.error('❌ Error checking MV status:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

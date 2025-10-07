/**
 * Check the actual materialized view directly
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const MOLINA_PAYER_ID = '8b48c3e2-f555-4d67-8122-c086466ba97d'

        // Try to query the MV directly with _mv suffix
        const { count: mvCount, error: mvError } = await supabaseAdmin
            .from('bookable_provider_payers_v2_mv')
            .select('*', { count: 'exact', head: true })
            .eq('payer_id', MOLINA_PAYER_ID)

        const { data: mvSample } = await supabaseAdmin
            .from('bookable_provider_payers_v2_mv')
            .select('*')
            .eq('payer_id', MOLINA_PAYER_ID)
            .limit(5)

        return NextResponse.json({
            success: true,
            bookable_provider_payers_v2_mv: {
                count: mvCount,
                sample: mvSample,
                error: mvError?.message
            },
            note: 'This queries the materialized view directly (_mv suffix)'
        })

    } catch (error: any) {
        console.error('❌ Error checking MV raw:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

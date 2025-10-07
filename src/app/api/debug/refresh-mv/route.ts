/**
 * Debug endpoint to check and refresh materialized views
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        console.log('🔄 Attempting to refresh materialized view...')

        // Try using the refresh function wrapper from the database
        const { data: refreshResult, error: refreshError } = await supabaseAdmin
            .rpc('refresh_bookable_provider_payers_v2', { p_concurrent: false })

        if (refreshError) {
            console.error('❌ Error calling refresh function:', refreshError)
            return NextResponse.json({
                success: false,
                error: refreshError.message,
                hint: 'The refresh_bookable_provider_payers_v2 function may not exist. Check Supabase dashboard.'
            }, { status: 500 })
        }

        console.log('✅ Refresh function called successfully')

        // Check row count after refresh
        const { count: beforeCount } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*', { count: 'exact', head: true })

        // Check if our specific provider-payer combo now exists
        const { data: testData, error: testError } = await supabaseAdmin
            .from('bookable_provider_payers_v2')
            .select('*')
            .eq('provider_id', '504d53c6-54ef-40b0-81d4-80812c2c7bfd')
            .eq('payer_id', '8b48c3e2-f555-4d67-8122-c086466ba97d')

        return NextResponse.json({
            success: true,
            message: 'Materialized view refreshed successfully',
            bookable_provider_payers_v2_count: beforeCount,
            test_provider_payer_found: testData && testData.length > 0,
            test_data: testData
        })

    } catch (error: any) {
        console.error('❌ Error in refresh endpoint:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

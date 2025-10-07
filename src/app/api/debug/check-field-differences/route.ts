/**
 * Debug endpoint to check if billing_provider_id and rendering_provider_id differ
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Get all bookable relationships
        const { data: relationships, error } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('provider_id, network_status, billing_provider_id, rendering_provider_id')
            .limit(100)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Check if fields ever differ
        const differences = relationships?.filter(r =>
            r.billing_provider_id !== r.rendering_provider_id
        ) || []

        const supervised = relationships?.filter(r => r.network_status === 'supervised') || []
        const direct = relationships?.filter(r => r.network_status === 'in_network') || []

        return NextResponse.json({
            success: true,
            total_relationships: relationships?.length || 0,
            supervised_count: supervised.length,
            direct_count: direct.length,
            fields_differ_count: differences.length,
            differences: differences,
            sample_supervised: supervised[0],
            sample_direct: direct[0],
            conclusion: differences.length === 0
                ? 'billing_provider_id and rendering_provider_id are ALWAYS the same'
                : 'billing_provider_id and rendering_provider_id sometimes differ'
        })

    } catch (error: any) {
        console.error('❌ Error checking field differences:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

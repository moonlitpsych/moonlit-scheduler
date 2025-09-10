// Debug: Test canonical view access
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Testing canonical view access...')
        
        // Test basic view access
        const { data, error } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .limit(5)

        if (error) {
            console.error('❌ Error accessing canonical view:', error)
            return NextResponse.json({
                success: false,
                error: 'Cannot access v_bookable_provider_payer',
                details: error
            })
        }

        console.log('✅ Canonical view accessible, sample data:', data)

        return NextResponse.json({
            success: true,
            message: 'Canonical view accessible',
            sample_data: data,
            total_records: data?.length || 0
        })

    } catch (error: any) {
        console.error('❌ Debug error:', error)
        return NextResponse.json({
            success: false,
            error: 'Debug endpoint error',
            details: error.message
        })
    }
}
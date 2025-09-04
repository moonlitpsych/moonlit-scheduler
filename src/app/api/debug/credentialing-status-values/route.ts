import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET() {
    try {
        console.log('🔍 Fetching all status_code values...')
        
        const { data: statusData, error } = await supabaseAdmin
            .from('payers')
            .select('status_code')

        if (error) {
            console.error('❌ Error fetching status data:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get unique values and count them
        const statusCounts: Record<string, number> = {}
        statusData?.forEach(row => {
            const status = row.status_code || 'null'
            statusCounts[status] = (statusCounts[status] || 0) + 1
        })

        console.log('✅ Found status_code distribution:', statusCounts)
        
        return NextResponse.json({
            unique_values: Object.keys(statusCounts),
            counts: statusCounts,
            total_records: statusData?.length || 0
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
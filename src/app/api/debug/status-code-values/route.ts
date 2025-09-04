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
            .select('status_code, name')

        if (error) {
            console.error('❌ Error fetching status data:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get unique values and count them
        const statusCodeCounts: Record<string, number> = {}
        
        statusData?.forEach(row => {
            const statusCode = row.status_code || 'null'
            statusCodeCounts[statusCode] = (statusCodeCounts[statusCode] || 0) + 1
        })

        console.log('✅ Found status_code distribution:', statusCodeCounts)
        
        return NextResponse.json({
            status_code_values: Object.keys(statusCodeCounts),
            status_code_counts: statusCodeCounts,
            total_records: statusData?.length || 0,
            sample_records: statusData?.slice(0, 3) || []
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
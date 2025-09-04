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
        console.log('🔍 Fetching UUHP data for debugging...')
        
        // Search for University of Utah Health Plans
        const { data: uuhpData, error } = await supabaseAdmin
            .from('payers')
            .select('*')
            .ilike('name', '%University of Utah Health Plans%')

        if (error) {
            console.error('❌ Error fetching UUHP data:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('✅ Found UUHP records:', uuhpData?.length || 0)
        
        // Also search for any UUHP variants
        const { data: uuhpVariants, error: variantError } = await supabaseAdmin
            .from('payers')
            .select('*')
            .or('name.ilike.%UUHP%,name.ilike.%Utah Health%')

        if (variantError) {
            console.warn('⚠️ Error fetching UUHP variants:', variantError)
        }

        return NextResponse.json({
            uuhp_exact: uuhpData || [],
            uuhp_variants: uuhpVariants || [],
            analysis: {
                exact_count: uuhpData?.length || 0,
                variant_count: uuhpVariants?.length || 0,
                sample_record: uuhpData?.[0] || null
            }
        })

    } catch (error: any) {
        console.error('💥 Debug API error:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
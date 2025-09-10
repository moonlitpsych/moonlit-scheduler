// Debug: Simple table check
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Testing simple table access...')
        
        // Test payers table
        const { data: payers, error: payerError } = await supabaseAdmin
            .from('payers')
            .select('id, name')
            .limit(3)

        if (payerError) {
            console.error('❌ Payers table error:', payerError)
        }

        console.log('✅ Payers table result:', payers)

        return NextResponse.json({
            success: true,
            payers_sample: payers,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('❌ Debug error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        })
    }
}
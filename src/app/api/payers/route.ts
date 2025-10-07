import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching all payers...')

    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, state, status_code, requires_attending')
      .order('name')

    if (error) {
      console.error('❌ Error fetching payers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers', details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${payers?.length || 0} payers`)

    return NextResponse.json({
      success: true,
      data: payers || [],
      total: payers?.length || 0
    })

  } catch (error: any) {
    console.error('❌ Error in payers API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch payers',
        details: error.message
      },
      { status: 500 }
    )
  }
}

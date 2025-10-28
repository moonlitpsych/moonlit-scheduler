import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Find payers where requires_individual_contract = false
    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, state, requires_individual_contract, allows_supervised')
      .eq('requires_individual_contract', false)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching payers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: payers?.length || 0,
      payers: payers || []
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

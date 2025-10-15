// Debug Step 7: Check v_bookable_provider_payer view
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get SelectHealth and Privratsky IDs
    const { data: shData } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%selecthealth%')
      .single()

    const { data: privData } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .ilike('last_name', '%privratsky%')
      .single()

    if (!shData || !privData) {
      return NextResponse.json({
        success: false,
        error: 'SelectHealth or Privratsky not found'
      }, { status: 404 })
    }

    // Check if Privratsky + SelectHealth appears in view
    const { data: privSH, error: privSHError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('provider_id', privData.id)
      .eq('payer_id', shData.id)
      .maybeSingle()

    // Get all providers bookable for SelectHealth
    const { data: allSH, error: allSHError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('*')
      .eq('payer_id', shData.id)

    return NextResponse.json({
      success: true,
      selecthealth_id: shData.id,
      selecthealth_name: shData.name,
      privratsky_id: privData.id,
      privratsky_name: `${privData.first_name} ${privData.last_name}`,
      privratsky_selecthealth_in_view: privSH || null,
      privratsky_selecthealth_error: privSHError?.message,
      all_selecthealth_bookable: allSH || [],
      all_selecthealth_count: allSH?.length || 0,
      all_selecthealth_error: allSHError?.message
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get ALL payers and group by requires_individual_contract status
    const { data: allPayers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, state, requires_individual_contract')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching payers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by status
    const withGroupContract = allPayers?.filter(p => p.requires_individual_contract === false) || []
    const requiresIndividual = allPayers?.filter(p => p.requires_individual_contract === true) || []
    const nullOrUndefined = allPayers?.filter(p => p.requires_individual_contract === null || p.requires_individual_contract === undefined) || []

    return NextResponse.json({
      success: true,
      total_payers: allPayers?.length || 0,
      breakdown: {
        group_contract: withGroupContract.length,
        requires_individual: requiresIndividual.length,
        null_or_undefined: nullOrUndefined.length
      },
      payers_with_null: nullOrUndefined
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

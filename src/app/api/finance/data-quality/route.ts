// API endpoint for data quality monitoring
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get data quality metrics
    const { data: quality, error: qualityError } = await supabaseAdmin
      .from('v_data_quality_dashboard')
      .select('*')
      .single()

    if (qualityError) {
      console.error('Data quality query error:', qualityError)
      // If view doesn't exist yet, return placeholder
      if (qualityError.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          message: 'Data quality view not yet deployed',
          data: null
        })
      }
      throw qualityError
    }

    // Get provider balance summary
    const { data: balances, error: balanceError } = await supabaseAdmin
      .from('v_provider_current_balance')
      .select('*')
      .limit(10)

    // Get recent unmatched CSV imports
    const { data: imports, error: importError } = await supabaseAdmin
      .from('csv_imports')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(5)

    // Get unreconciled deposits (if table exists)
    const { data: deposits } = await supabaseAdmin
      .from('v_unreconciled_deposits')
      .select('*')
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        quality_metrics: quality,
        provider_balances: balances || [],
        recent_imports: imports || [],
        unreconciled_deposits: deposits || [],
        summary: {
          intakeq_sync_rate: quality?.pct_with_intakeq || 0,
          claims_paid_rate: quality?.pct_claims_paid || 0,
          provider_payment_rate: quality?.pct_provider_paid || 0,
          data_override_rate: quality?.pct_appointments_with_overrides || 0,
          total_providers_owed: balances?.length || 0,
          total_balance_owed_cents: balances?.reduce((sum: number, b: any) => sum + (b.current_balance_cents || 0), 0) || 0
        }
      }
    })

  } catch (error: any) {
    console.error('Data quality error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Checking if columns actually exist in database...')

    // Direct SQL query to check columns
    const { data: ppnTest, error: ppnError } = await supabase
      .from('provider_payer_networks')
      .select('id, provider_id, payer_id, billing_provider_id, notes, created_at, updated_at')
      .limit(1)

    console.log('provider_payer_networks test:', { ppnTest, ppnError })

    const { data: srTest, error: srError } = await supabase
      .from('supervision_relationships')
      .select('id, supervisor_provider_id, supervisee_provider_id, payer_id, supervision_level')
      .limit(1)

    console.log('supervision_relationships test:', { srTest, srError })

    return NextResponse.json({
      provider_payer_networks: {
        columns_exist: !ppnError,
        error: ppnError?.message || null,
        sample_row: ppnTest?.[0] || null
      },
      supervision_relationships: {
        columns_exist: !srError,
        error: srError?.message || null,
        sample_row: srTest?.[0] || null
      }
    })

  } catch (error: any) {
    console.error('❌ Verification error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

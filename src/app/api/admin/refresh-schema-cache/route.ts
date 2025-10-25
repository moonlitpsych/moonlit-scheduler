import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST() {
  try {
    console.log('🔍 Step 1: Verifying provider_payer_networks columns...')

    // Check provider_payer_networks columns
    const { data: ppnColumns, error: ppnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'provider_payer_networks')
      .in('column_name', ['billing_provider_id', 'notes', 'created_at', 'updated_at'])
      .order('column_name')

    console.log('provider_payer_networks columns:', ppnColumns)

    console.log('\n🔍 Step 2: Verifying supervision_relationships columns...')

    // Check supervision_relationships columns
    const { data: srColumns, error: srError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'supervision_relationships')
      .in('column_name', ['supervisor_provider_id', 'supervisee_provider_id', 'payer_id', 'supervision_level'])
      .order('column_name')

    console.log('supervision_relationships columns:', srColumns)

    console.log('\n🔄 Step 3: Refreshing PostgREST schema cache...')

    // Send NOTIFY to refresh schema cache
    // This requires direct SQL execution
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY!}`
        },
        body: JSON.stringify({
          query: "NOTIFY pgrst, 'reload schema';"
        })
      }
    )

    console.log('✅ Schema cache refresh request sent')

    return NextResponse.json({
      success: true,
      provider_payer_networks_columns: ppnColumns,
      supervision_relationships_columns: srColumns,
      message: 'Schema verification complete. Cache refresh signal sent.'
    })

  } catch (error: any) {
    console.error('❌ Schema refresh error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function verifyAndRefreshSchema() {
  console.log('🔍 Step 1: Verifying provider_payer_networks columns...')

  const { data: ppnColumns, error: ppnError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'provider_payer_networks'
      AND column_name IN ('billing_provider_id', 'notes', 'created_at', 'updated_at')
      ORDER BY column_name;
    `
  })

  if (ppnError) {
    console.log('❌ Error checking provider_payer_networks:', ppnError)
  } else {
    console.log('✅ provider_payer_networks columns:', ppnColumns)
  }

  console.log('\n🔍 Step 2: Verifying supervision_relationships columns...')

  const { data: srColumns, error: srError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'supervision_relationships'
      AND column_name IN ('supervisor_provider_id', 'supervisee_provider_id', 'payer_id', 'supervision_level')
      ORDER BY column_name;
    `
  })

  if (srError) {
    console.log('❌ Error checking supervision_relationships:', srError)
  } else {
    console.log('✅ supervision_relationships columns:', srColumns)
  }

  console.log('\n🔄 Step 3: Refreshing PostgREST schema cache...')

  const { data: refresh, error: refreshError } = await supabase.rpc('exec_sql', {
    query: `NOTIFY pgrst, 'reload schema';`
  })

  if (refreshError) {
    console.log('❌ Error refreshing schema cache:', refreshError)
  } else {
    console.log('✅ Schema cache refresh sent successfully!')
  }

  process.exit(0)
}

verifyAndRefreshSchema()

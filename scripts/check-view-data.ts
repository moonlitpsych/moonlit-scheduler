import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkViewData() {
  const drNorsethId = '35ab086b-2894-446d-9ab5-3d41613017ad'

  console.log('🔍 Checking materialized view data for Dr. Norseth\n')

  // Check if materialized view has data
  const { data: viewData, error } = await supabase
    .from('v_patient_activity_summary')
    .select('*')
    .eq('primary_provider_id', drNorsethId)

  if (error) {
    console.error('❌ Error querying view:', error)
  } else {
    console.log(`Found ${viewData?.length || 0} records in materialized view`)
    viewData?.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} | Status: ${p.engagement_status}`)
    })
  }

  console.log('\n🔄 Refreshing materialized view...')
  const { error: refreshError } = await supabase.rpc('refresh_patient_activity_summary')

  if (refreshError) {
    console.error('❌ Error refreshing view:', refreshError)
  } else {
    console.log('✅ View refreshed successfully')
  }

  console.log('\n🔍 Checking view data after refresh...')
  const { data: viewDataAfter } = await supabase
    .from('v_patient_activity_summary')
    .select('*')
    .eq('primary_provider_id', drNorsethId)

  console.log(`Found ${viewDataAfter?.length || 0} records after refresh`)
  viewDataAfter?.forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name} | Status: ${p.engagement_status}`)
  })
}

checkViewData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

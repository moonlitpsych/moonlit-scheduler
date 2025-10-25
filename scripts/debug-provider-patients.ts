/**
 * Debug Script: Check Provider Patient Assignments
 *
 * Investigates why Dr. Travis Norseth's provider view shows 0 patients
 * despite having patients assigned in the database.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugProviderPatients() {
  const drNorsethId = 'e10bae12-2d42-47f0-b554-b6cd688719d7'

  console.log('🔍 Debugging Dr. Travis Norseth Patient Assignments\n')
  console.log(`Provider ID: ${drNorsethId}\n`)

  // 1. Check provider record
  console.log('1️⃣ Provider Record:')
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('id', drNorsethId)
    .single()

  console.log(JSON.stringify(provider, null, 2))
  console.log('\n')

  // 2. Check patients table for primary_provider_id
  console.log('2️⃣ Patients with primary_provider_id = Dr. Norseth:')
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, primary_provider_id')
    .eq('primary_provider_id', drNorsethId)

  if (patientsError) {
    console.error('Error:', patientsError)
  } else {
    console.log(`Found ${patients?.length || 0} patients`)
    patients?.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} (${p.id})`)
    })
  }
  console.log('\n')

  // 3. Check materialized view for primary_provider_id
  console.log('3️⃣ Materialized View (v_patient_activity_summary) with primary_provider_id = Dr. Norseth:')
  const { data: viewData, error: viewError } = await supabase
    .from('v_patient_activity_summary')
    .select('patient_id, first_name, last_name, primary_provider_id, provider_first_name, provider_last_name, engagement_status')
    .eq('primary_provider_id', drNorsethId)

  if (viewError) {
    console.error('Error:', viewError)
  } else {
    console.log(`Found ${viewData?.length || 0} records`)
    viewData?.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} | Status: ${p.engagement_status} | Provider: ${p.provider_first_name} ${p.provider_last_name}`)
    })
  }
  console.log('\n')

  // 4. Check activity summary API endpoint
  console.log('4️⃣ Activity Summary API Query (what the provider view uses):')
  const { data: apiData, error: apiError } = await supabase
    .from('v_patient_activity_summary')
    .select('*')
    .eq('primary_provider_id', drNorsethId)
    .eq('engagement_status', 'active')

  if (apiError) {
    console.error('Error:', apiError)
  } else {
    console.log(`Found ${apiData?.length || 0} active patients`)
    apiData?.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name}`)
    })
  }
  console.log('\n')

  // 5. Check partner dashboard query (different approach)
  console.log('5️⃣ Partner Dashboard Approach (checking patient_provider_assignments):')
  const { data: assignments } = await supabase
    .from('patient_provider_assignments')
    .select(`
      id,
      patient_id,
      provider_id,
      assignment_type,
      status,
      patients (
        first_name,
        last_name
      )
    `)
    .eq('provider_id', drNorsethId)
    .eq('status', 'active')

  console.log(`Found ${assignments?.length || 0} assignments`)
  assignments?.forEach((a: any) => {
    console.log(`  - ${a.patients?.first_name} ${a.patients?.last_name} | Type: ${a.assignment_type}`)
  })
  console.log('\n')

  // 6. Summary
  console.log('📊 SUMMARY:')
  console.log(`Patients table with primary_provider_id: ${patients?.length || 0}`)
  console.log(`Materialized view with primary_provider_id: ${viewData?.length || 0}`)
  console.log(`API query (active only): ${apiData?.length || 0}`)
  console.log(`Provider assignments table: ${assignments?.length || 0}`)
}

debugProviderPatients()
  .then(() => {
    console.log('\n✅ Debug complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error)
    process.exit(1)
  })

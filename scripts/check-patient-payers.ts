import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPatientPayers() {
  console.log('🔍 Checking patient payer data...\n')

  // Get all patients with payer info
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, first_name, last_name, primary_payer_id')
    .order('last_name')

  if (error) {
    console.error('❌ Error fetching patients:', error)
    return
  }

  console.log(`📊 Total patients: ${patients.length}`)

  const patientsWithPayer = patients.filter(p => p.primary_payer_id !== null)
  const patientsWithoutPayer = patients.filter(p => p.primary_payer_id === null)

  console.log(`✅ Patients with payer: ${patientsWithPayer.length}`)
  console.log(`❌ Patients without payer: ${patientsWithoutPayer.length}`)
  console.log(`📈 Payer coverage: ${((patientsWithPayer.length / patients.length) * 100).toFixed(1)}%\n`)

  // Get unique payers
  const uniquePayerIds = [...new Set(patientsWithPayer.map(p => p.primary_payer_id))]

  console.log(`🏢 Unique payers: ${uniquePayerIds.length}\n`)

  // Get payer details
  const { data: payers, error: payersError } = await supabase
    .from('payers')
    .select('id, name, payer_type, state')
    .in('id', uniquePayerIds)

  if (!payersError && payers) {
    console.log('📋 Payers on file:')
    payers.forEach(payer => {
      const patientCount = patientsWithPayer.filter(p => p.primary_payer_id === payer.id).length
      console.log(`  - ${payer.name} (${payer.payer_type}, ${payer.state}): ${patientCount} patients`)
    })
  }

  console.log('\n📝 Sample patients WITHOUT payer:')
  patientsWithoutPayer.slice(0, 10).forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name} (${p.id})`)
  })

  console.log('\n💡 This is likely expected - not all patients have registered their insurance yet.')
  console.log('   As patients book appointments, their payer info will be captured.')
}

checkPatientPayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

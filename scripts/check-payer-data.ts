import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPayerData() {
  console.log('🔍 Checking payer data availability...\n')

  // Check patients table structure
  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .limit(1)
    .single()

  if (patient) {
    console.log('📋 Patients table has these fields:')
    console.log(Object.keys(patient).sort().join(', '))
    console.log('\nPayer-related fields:')
    Object.keys(patient).forEach(key => {
      if (key.toLowerCase().includes('payer') || key.toLowerCase().includes('insurance')) {
        console.log(`  - ${key}: ${patient[key]}`)
      }
    })
  }

  // Check materialized view
  const { data: viewData } = await supabase
    .from('v_patient_activity_summary')
    .select('*')
    .limit(1)
    .single()

  if (viewData) {
    console.log('\n📊 Materialized view has these fields:')
    console.log(Object.keys(viewData).sort().join(', '))
    console.log('\nPayer-related fields in view:')
    Object.keys(viewData).forEach(key => {
      if (key.toLowerCase().includes('payer') || key.toLowerCase().includes('insurance')) {
        console.log(`  - ${key}: ${viewData[key]}`)
      }
    })
  }

  // Check most recent appointments with payers
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, patient_id, payer_id, payers(name)')
    .not('payer_id', 'is', null)
    .limit(3)

  console.log('\n💼 Sample appointments with payers:')
  appointments?.forEach(apt => {
    console.log(`  Patient: ${apt.patient_id}, Payer: ${(apt.payers as any)?.name}`)
  })
}

checkPayerData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

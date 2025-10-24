import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPatientsSchema() {
  console.log('🔍 Checking patients table schema...\n')

  // Get a sample patient to see all columns
  const { data: samplePatient, error } = await supabase
    .from('patients')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('❌ Error fetching patient:', error)
    return
  }

  console.log('📋 Patients table columns:')
  const columns = Object.keys(samplePatient).sort()
  columns.forEach(col => {
    console.log(`  - ${col}`)
  })

  console.log('\n🔍 Checking for practiceq/sync related columns:')
  const syncColumns = columns.filter(col =>
    col.toLowerCase().includes('practiceq') ||
    col.toLowerCase().includes('sync') ||
    col.toLowerCase().includes('intakeq')
  )

  if (syncColumns.length > 0) {
    console.log('  Found:', syncColumns.join(', '))
  } else {
    console.log('  ❌ No sync-related columns found')
  }
}

checkPatientsSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

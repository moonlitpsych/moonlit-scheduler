import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function listPayers() {
  const { data, error } = await supabase
    .from('payers')
    .select('id, name, payer_type, state')
    .order('name')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`🏥 All Payers in Database (${data?.length} total):\n`)
  data?.forEach((p: any) => {
    console.log(`📋 ${p.name}`)
    console.log(`   Type: ${p.payer_type}, State: ${p.state}`)
    console.log(`   ID: ${p.id}`)
    console.log()
  })

  console.log('\n📝 Common insurance names from IntakeQ custom fields:')
  const intakeqNames = [
    'Medicaid',
    'Utah Medicaid',
    'Health Choice of Utah - Integrated Medicaid',
    'UUHP',
    'Targeted Adult Medicaid',
    'TAM Medicaid',
    'TAMS medicaid',
    'HCU',
    'DMBA'
  ]

  console.log('\nWe need to map these IntakeQ names to payer IDs:')
  intakeqNames.forEach(name => console.log(`  - "${name}"`))
}

listPayers().then(() => process.exit(0)).catch(console.error)

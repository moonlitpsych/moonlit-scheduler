import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPayersSchema() {
  console.log('🔍 Checking payers table schema...\n')

  // Get a sample payer to see all columns
  const { data: samplePayer, error } = await supabase
    .from('payers')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('❌ Error fetching payer:', error)
    return
  }

  console.log('📋 Payers table columns:')
  console.log(Object.keys(samplePayer).sort().join('\n'))

  console.log('\n📊 Sample payer data:')
  console.log(JSON.stringify(samplePayer, null, 2))
}

checkPayersSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

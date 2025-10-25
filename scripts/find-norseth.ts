import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findNorseth() {
  console.log('🔍 Finding Dr. Travis Norseth...\n')

  const { data: providers } = await supabase
    .from('providers')
    .select('id, first_name, last_name, email, auth_user_id, is_active')
    .ilike('last_name', '%Norseth%')

  console.log('Found providers:')
  providers?.forEach(p => {
    console.log(`  ID: ${p.id}`)
    console.log(`  Name: ${p.first_name} ${p.last_name}`)
    console.log(`  Email: ${p.email}`)
    console.log(`  Auth User ID: ${p.auth_user_id}`)
    console.log(`  Active: ${p.is_active}`)
    console.log('')
  })

  // Check if there are patients assigned
  for (const provider of providers || []) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('primary_provider_id', provider.id)
      .limit(5)

    console.log(`${provider.first_name} ${provider.last_name} has ${patients?.length || 0} patients:`)
    patients?.forEach(p => console.log(`  - ${p.first_name} ${p.last_name}`))
    console.log('')
  }
}

findNorseth()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

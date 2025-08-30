/**
 * Check Database Setup - See what data exists
 */

const { createClient } = require('@supabase/supabase-js')
const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkTables() {
  console.log(`
🔍 CHECKING DATABASE SETUP
========================
`)

  // Check payers table
  console.log('📋 Checking payers table...')
  const { data: payers, error: payersError } = await supabase
    .from('payers')
    .select('id, name, payer_type, state')
    .limit(10)
  
  if (payersError) {
    console.error('❌ Error getting payers:', payersError)
  } else {
    console.log(`Found ${payers.length} payers:`)
    payers.forEach(p => {
      console.log(`   • ${p.name} (${p.payer_type}) - ${p.state} - ID: ${p.id}`)
    })
    
    // Look for Utah Medicaid specifically
    const { data: utahMedicaid } = await supabase
      .from('payers')
      .select('*')
      .ilike('name', '%utah%medicaid%')
    
    if (utahMedicaid && utahMedicaid.length > 0) {
      console.log('\n🎯 Found Utah Medicaid payers:')
      utahMedicaid.forEach(p => {
        console.log(`   • ${p.name} - ID: ${p.id}`)
      })
    }
  }
  
  // Check existing provider-payer networks
  console.log('\n🏥 Checking existing provider-payer networks...')
  const { data: networks, error: networksError } = await supabase
    .from('provider_payer_networks')
    .select(`
      id,
      provider_id,
      payer_id,
      status,
      providers!inner(first_name, last_name),
      payers!inner(name)
    `)
    .limit(10)
  
  if (networksError) {
    console.error('❌ Error getting networks:', networksError)
  } else {
    console.log(`Found ${networks.length} existing provider-payer networks:`)
    networks.forEach(n => {
      console.log(`   • ${n.providers.first_name} ${n.providers.last_name} → ${n.payers.name}`)
    })
  }
  
  // Check provider availability
  console.log('\n📅 Checking provider availability...')
  const { data: availability, error: availError } = await supabase
    .from('provider_availability')
    .select(`
      provider_id,
      day_of_week,
      start_time,
      end_time,
      providers!inner(first_name, last_name)
    `)
    .limit(10)
  
  if (availError) {
    console.error('❌ Error getting availability:', availError)
  } else {
    console.log(`Found ${availability.length} availability records:`)
    availability.forEach(a => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      console.log(`   • ${a.providers.first_name} ${a.providers.last_name}: ${days[a.day_of_week]} ${a.start_time}-${a.end_time}`)
    })
  }
  
  console.log(`
✅ Database check complete!

Use the payer IDs found above in your test scripts.
`)
}

checkTables().catch(console.error)
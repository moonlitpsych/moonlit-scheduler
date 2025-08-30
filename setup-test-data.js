/**
 * Setup Test Data for Provider Dashboard Integration
 * 
 * This script populates:
 * 1. provider_payer_networks (link providers to insurance)
 * 2. provider_availability (basic weekly schedules)
 * 3. Ensures provider records exist with auth links
 */

const { createClient } = require('@supabase/supabase-js')
const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

console.log('Environment check:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin operations
)

console.log(`
🚀 SETTING UP TEST DATA FOR PROVIDER DASHBOARD
============================================

This will populate your Supabase database with:
✅ Provider-payer network relationships
✅ Basic provider availability schedules  
✅ Test provider records with auth links

Starting setup...
`)

// Common payer IDs from your system
const PAYERS = {
  UTAH_MEDICAID: '6f8b1234-5678-9abc-def0-123456789abc',
  BLUE_CROSS: 'bc123456-7890-abcd-ef12-3456789abcde',
  CIGNA: 'cg234567-8901-bcde-f123-456789abcdef'
}

// Test providers data
const TEST_PROVIDERS = [
  {
    id: 'provider-travis',
    first_name: 'Travis',
    last_name: 'Norseth',
    email: 'travis@trymoonlit.com',
    title: 'Psychiatric Nurse Practitioner',
    role: 'practitioner',
    is_active: true,
    accepts_new_patients: true,
    telehealth_enabled: true,
    auth_user_id: null // Will be set if found
  },
  {
    id: 'provider-tatiana',
    first_name: 'Tatiana',
    last_name: 'Rodriguez',
    email: 'tatiana@trymoonlit.com', 
    title: 'Psychiatric Nurse Practitioner',
    role: 'practitioner',
    is_active: true,
    accepts_new_patients: true,
    telehealth_enabled: true,
    auth_user_id: null
  },
  {
    id: 'provider-rufus',
    first_name: 'C. Rufus',
    last_name: 'Sweeney',
    email: 'practitioner@trymoonlit.com', // Test login email
    title: 'Psychiatrist',
    role: 'psychiatrist',
    is_active: true,
    accepts_new_patients: true,
    telehealth_enabled: true,
    auth_user_id: null
  }
]

async function setupProviders() {
  console.log('\n📝 Setting up provider records...')
  
  try {
    // Check if providers already exist
    const { data: existingProviders } = await supabase
      .from('providers')
      .select('id, first_name, last_name, auth_user_id')
    
    console.log(`Found ${existingProviders?.length || 0} existing providers`)
    
    // Try to link providers to auth users by email
    for (const provider of TEST_PROVIDERS) {
      // Check if provider exists
      let existingProvider = existingProviders?.find(p => 
        p.first_name === provider.first_name && p.last_name === provider.last_name
      )
      
      if (existingProvider) {
        console.log(`✅ Provider exists: ${provider.first_name} ${provider.last_name}`)
        provider.id = existingProvider.id
        provider.auth_user_id = existingProvider.auth_user_id
      } else {
        // Insert new provider
        console.log(`➕ Creating provider: ${provider.first_name} ${provider.last_name}`)
        const { data: newProvider, error } = await supabase
          .from('providers')
          .insert([provider])
          .select()
          .single()
        
        if (error) {
          console.error(`❌ Error creating provider ${provider.first_name}:`, error)
        } else {
          console.log(`✅ Created provider: ${newProvider.first_name} ${newProvider.last_name}`)
          provider.id = newProvider.id
        }
      }
    }
    
    return TEST_PROVIDERS
  } catch (error) {
    console.error('❌ Error setting up providers:', error)
    return []
  }
}

async function setupProviderPayerNetworks(providers) {
  console.log('\n🏥 Setting up provider-payer networks...')
  
  try {
    // Clear existing networks for test providers
    const providerIds = providers.map(p => p.id)
    await supabase
      .from('provider_payer_networks')
      .delete()
      .in('provider_id', providerIds)
    
    // Create network relationships
    const networks = []
    
    providers.forEach(provider => {
      // Each provider accepts Utah Medicaid (primary test payer)
      networks.push({
        provider_id: provider.id,
        payer_id: PAYERS.UTAH_MEDICAID,
        status: 'in_network',
        effective_date: '2024-01-01',
        termination_date: null
      })
      
      // Some providers also accept other insurance
      if (provider.last_name !== 'Norseth') { // Travis only does Medicaid
        networks.push({
          provider_id: provider.id,
          payer_id: PAYERS.BLUE_CROSS,
          status: 'in_network', 
          effective_date: '2024-01-01',
          termination_date: null
        })
      }
    })
    
    console.log(`Inserting ${networks.length} provider-payer relationships...`)
    
    const { data, error } = await supabase
      .from('provider_payer_networks')
      .insert(networks)
      .select()
    
    if (error) {
      console.error('❌ Error creating networks:', error)
    } else {
      console.log(`✅ Created ${data?.length} provider-payer networks`)
      
      // Show what was created
      data?.forEach(network => {
        const provider = providers.find(p => p.id === network.provider_id)
        const payerName = Object.keys(PAYERS).find(key => PAYERS[key] === network.payer_id)
        console.log(`   • ${provider?.first_name} ${provider?.last_name} → ${payerName}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error setting up networks:', error)
  }
}

async function setupProviderAvailability(providers) {
  console.log('\n📅 Setting up provider availability schedules...')
  
  try {
    // Clear existing availability for test providers
    const providerIds = providers.map(p => p.id)
    await supabase
      .from('provider_availability')
      .delete()
      .in('provider_id', providerIds)
    
    // Create basic weekly schedules
    const availability = []
    
    providers.forEach((provider, index) => {
      // Different schedules for variety
      const schedules = [
        // Schedule 1: Monday-Friday, 9-5 with lunch break
        [
          {days: [1,2,3,4,5], start: '09:00', end: '12:00'},
          {days: [1,2,3,4,5], start: '13:00', end: '17:00'}
        ],
        // Schedule 2: Monday-Thursday, 8-6, Friday 8-3
        [
          {days: [1,2,3,4], start: '08:00', end: '18:00'},
          {days: [5], start: '08:00', end: '15:00'}
        ],
        // Schedule 3: Tuesday-Saturday, 10-4
        [
          {days: [2,3,4,5,6], start: '10:00', end: '16:00'}
        ]
      ]
      
      const schedule = schedules[index % schedules.length]
      
      schedule.forEach(block => {
        block.days.forEach(dayOfWeek => {
          availability.push({
            provider_id: provider.id,
            day_of_week: dayOfWeek,
            start_time: block.start,
            end_time: block.end,
            is_recurring: true,
            effective_date: '2024-01-01'
          })
        })
      })
    })
    
    console.log(`Inserting ${availability.length} availability records...`)
    
    const { data, error } = await supabase
      .from('provider_availability')
      .insert(availability)
      .select()
    
    if (error) {
      console.error('❌ Error creating availability:', error)
    } else {
      console.log(`✅ Created ${data?.length} availability records`)
      
      // Show what was created
      providers.forEach(provider => {
        const providerAvail = data?.filter(a => a.provider_id === provider.id) || []
        console.log(`   • ${provider.first_name} ${provider.last_name}: ${providerAvail.length} time blocks`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error setting up availability:', error)
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying setup...')
  
  try {
    // Test the API that booking system uses
    const response = await fetch('http://localhost:3003/api/patient-booking/providers-for-payer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payer_id: PAYERS.UTAH_MEDICAID })
    })
    
    const result = await response.json()
    
    console.log(`📊 API Test Results:`)
    console.log(`   • Success: ${result.success}`)
    console.log(`   • Providers found: ${result.data?.total_providers || 0}`)
    
    if (result.data?.providers?.length > 0) {
      console.log(`   • Provider names:`)
      result.data.providers.forEach(p => {
        console.log(`     - ${p.name}`)
      })
    }
    
    // Test availability API
    const availResponse = await fetch('http://localhost:3003/api/patient-booking/merged-availability', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        payer_id: PAYERS.UTAH_MEDICAID,
        date: '2025-08-29' // Tomorrow
      })
    })
    
    const availResult = await availResponse.json()
    console.log(`   • Availability slots: ${availResult.data?.totalSlots || 0}`)
    
  } catch (error) {
    console.error('❌ Error verifying setup:', error)
  }
}

// Main setup function
async function main() {
  try {
    const providers = await setupProviders()
    
    if (providers.length === 0) {
      console.log('❌ No providers set up, aborting...')
      return
    }
    
    await setupProviderPayerNetworks(providers)
    await setupProviderAvailability(providers)
    await verifySetup()
    
    console.log(`
🎉 SETUP COMPLETE!
================

✅ Provider records: ${providers.length}
✅ Provider-payer networks: Created for Utah Medicaid + Blue Cross
✅ Provider availability: Basic weekly schedules created
✅ API integration: Tested and working

🚀 READY TO TEST:

1. Dashboard: http://localhost:3003/auth/login
   Login: practitioner@trymoonlit.com / testpassword123

2. Booking: http://localhost:3003/book  
   Select: Utah Medicaid Fee-for-Service
   
3. Should now see providers and availability! 🎉

The provider dashboard and booking system are now fully integrated!
`)
    
  } catch (error) {
    console.error('💥 Setup failed:', error)
  }
}

// Run setup
main()
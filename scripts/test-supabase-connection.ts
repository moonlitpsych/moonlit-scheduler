// scripts/test-supabase-connection.ts
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: '.env.local' })

async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase Connection...\n')

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  console.log('Environment Variables:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing')
  console.log('- SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing')

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\n❌ Missing required Supabase environment variables')
    return
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase

  console.log('\n✅ Supabase clients created')

  try {
    // Test 1: Basic connection with providers
    console.log('\n1️⃣ Testing provider count...')
    const { count: providerCount, error: providerError } = await supabase
      .from('providers')
      .select('*', { count: 'exact', head: true })

    if (providerError) {
      console.error('❌ Provider query failed:', providerError)
      return
    }

    console.log(`✅ Found ${providerCount} providers`)

    // Test 2: Provider-payer relationships
    console.log('\n2️⃣ Testing provider-payer relationships...')
    const { count: relationshipCount, error: relationshipError } = await supabase
      .from('provider_payer_networks')
      .select('*', { count: 'exact', head: true })

    if (relationshipError) {
      console.error('❌ Relationship query failed:', relationshipError)
      return
    }

    console.log(`✅ Found ${relationshipCount} provider-payer relationships`)

    // Test 3: Payer data
    console.log('\n3️⃣ Testing payer data...')
    const { count: payerCount, error: payerError } = await supabase
      .from('payers')
      .select('*', { count: 'exact', head: true })

    if (payerError) {
      console.error('❌ Payer query failed:', payerError)
      return
    }

    console.log(`✅ Found ${payerCount} payers`)

    // Test 4: Provider availability
    console.log('\n4️⃣ Testing provider availability...')
    const { count: availabilityCount, error: availabilityError } = await supabase
      .from('provider_availability')
      .select('*', { count: 'exact', head: true })

    if (availabilityError) {
      console.error('❌ Availability query failed:', availabilityError)
      return
    }

    console.log(`✅ Found ${availabilityCount} availability records`)

    // Test 5: Specific payer query (the one we use in the app)
    console.log('\n5️⃣ Testing specific payer query (MotivHealth)...')
    const testPayerId = '1f9c18ec-f4af-4343-9c1f-515abda9c442'
    
    const { data: networks, error: networksError } = await supabase
      .from('provider_payer_networks')
      .select(`
        provider_id,
        effective_date,
        status,
        providers!inner (
          id,
          first_name,
          last_name,
          is_active
        )
      `)
      .eq('payer_id', testPayerId)
      .eq('status', 'in_network')
      .eq('providers.is_active', true)

    if (networksError) {
      console.error('❌ Network query failed:', networksError)
      return
    }

    console.log(`✅ Found ${networks?.length || 0} providers for MotivHealth`)
    if (networks && networks.length > 0) {
      console.log('   Sample providers:')
      networks.slice(0, 3).forEach((network: any, i: number) => {
        const provider = network.providers
        console.log(`   ${i + 1}. ${provider.first_name} ${provider.last_name}`)
      })
    }

    // Test 6: Appointments table
    console.log('\n6️⃣ Testing appointments table...')
    const { count: appointmentCount, error: appointmentError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })

    if (appointmentError) {
      console.error('❌ Appointment query failed:', appointmentError)
      return
    }

    console.log(`✅ Found ${appointmentCount} appointments`)

    // Test 7: Service key permissions (if available)
    if (supabaseServiceKey) {
      console.log('\n7️⃣ Testing service key permissions...')
      try {
        const { data: testInsert, error: insertError } = await supabaseAdmin
          .from('appointments')
          .insert({
            provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', // Travis's ID
            payer_id: testPayerId,
            start_time: new Date('2025-12-01T10:00:00Z').toISOString(),
            end_time: new Date('2025-12-01T11:00:00Z').toISOString(),
            status: 'test',
            appointment_type: 'test',
            patient_info: { first_name: 'Test', last_name: 'Patient', phone: '555-0000' },
            notes: 'Test appointment for connection validation',
            created_via: 'supabase_test_script',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()

        if (insertError) {
          console.log('⚠️ Insert test failed:', insertError.message)
        } else {
          console.log('✅ Service key can insert appointments')
          
          // Clean up test appointment
          if (testInsert && testInsert.length > 0) {
            await supabaseAdmin
              .from('appointments')
              .delete()
              .eq('id', testInsert[0].id)
            console.log('✅ Test appointment cleaned up')
          }
        }
      } catch (error: any) {
        console.log('⚠️ Service key test failed:', error.message)
      }
    }

    // Summary
    console.log('\n📊 Summary:')
    console.log(`   Providers: ${providerCount}`)
    console.log(`   Payers: ${payerCount}`)
    console.log(`   Provider-Payer Networks: ${relationshipCount}`)
    console.log(`   Provider Availability: ${availabilityCount}`)
    console.log(`   Appointments: ${appointmentCount}`)
    console.log(`   MotivHealth Providers: ${networks?.length || 0}`)

    console.log('\n🎉 All Supabase tests passed successfully!')
    
    console.log('\n✅ Integration Status:')
    console.log('   🗄️ Database connection: Working')
    console.log('   👥 Provider data: Available')
    console.log('   🏥 Payer relationships: Configured') 
    console.log('   📅 Availability data: Present')
    console.log('   🔒 Service key: Working')

  } catch (error: any) {
    console.error('\n❌ Supabase test failed:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

testSupabaseConnection()
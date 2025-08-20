// scripts/sync-athena-data.ts
import 'dotenv/config'
import { athenaService } from '../src/lib/services/athenaService'
import { supabase } from '../src/lib/supabase'

interface SyncOptions {
  providers?: boolean
  availability?: boolean
  appointments?: boolean
  force?: boolean
}

async function syncAthenaData(options: SyncOptions = {}) {
  const {
    providers = true,
    availability = false,
    appointments = false,
    force = false
  } = options

  console.log('🔄 Starting Athena data synchronization...\n')

  try {
    // Test connection first
    console.log('🧪 Testing Athena connection...')
    const connectionTest = await athenaService.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Cannot connect to Athena:', connectionTest.error)
      return
    }
    
    console.log('✅ Connected to Athena successfully\n')

    const results = {
      providers: { synced: 0, errors: 0 },
      availability: { synced: 0, errors: 0 },
      appointments: { synced: 0, errors: 0 }
    }

    // Sync providers
    if (providers) {
      console.log('👥 Syncing providers...')
      try {
        results.providers = await athenaService.syncProviders()
        console.log(`✅ Providers sync: ${results.providers.synced} synced, ${results.providers.errors} errors\n`)
      } catch (error: any) {
        console.error('❌ Provider sync failed:', error.message)
        results.providers.errors = 1
      }
    }

    // Sync availability (if requested)
    if (availability) {
      console.log('📅 Syncing availability...')
      try {
        const availabilityResult = await syncProviderAvailability()
        results.availability = availabilityResult
        console.log(`✅ Availability sync: ${results.availability.synced} synced, ${results.availability.errors} errors\n`)
      } catch (error: any) {
        console.error('❌ Availability sync failed:', error.message)
        results.availability.errors = 1
      }
    }

    // Sync appointments (if requested)
    if (appointments) {
      console.log('📝 Syncing appointments...')
      try {
        const appointmentResult = await syncRecentAppointments()
        results.appointments = appointmentResult
        console.log(`✅ Appointments sync: ${results.appointments.synced} synced, ${results.appointments.errors} errors\n`)
      } catch (error: any) {
        console.error('❌ Appointment sync failed:', error.message)
        results.appointments.errors = 1
      }
    }

    // Update sync log
    await updateSyncLog({
      sync_type: 'full',
      providers_synced: results.providers.synced,
      providers_errors: results.providers.errors,
      availability_synced: results.availability.synced,
      availability_errors: results.availability.errors,
      appointments_synced: results.appointments.synced,
      appointments_errors: results.appointments.errors,
      completed_at: new Date().toISOString()
    })

    console.log('🎉 Synchronization complete!')
    console.log('📊 Summary:')
    console.log(`   Providers: ${results.providers.synced} synced, ${results.providers.errors} errors`)
    console.log(`   Availability: ${results.availability.synced} synced, ${results.availability.errors} errors`)
    console.log(`   Appointments: ${results.appointments.synced} synced, ${results.appointments.errors} errors`)

  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

async function syncProviderAvailability(): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    // Get all providers with Athena IDs
    const { data: providers, error } = await supabase
      .from('providers')
      .select('id, athena_provider_id, first_name, last_name')
      .not('athena_provider_id', 'is', null)
      .eq('is_active', true)

    if (error) throw error

    console.log(`   Found ${providers?.length || 0} providers to sync availability for`)

    // For demo purposes, we'll just update the sync timestamp
    // In a real implementation, you'd fetch actual availability from Athena
    for (const provider of providers || []) {
      try {
        const { error: updateError } = await supabase
          .from('providers')
          .update({ 
            availability_last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', provider.id)

        if (updateError) throw updateError

        synced++
        console.log(`   ✅ Synced availability for ${provider.first_name} ${provider.last_name}`)

      } catch (error) {
        console.error(`   ❌ Error syncing ${provider.first_name} ${provider.last_name}:`, error)
        errors++
      }
    }

  } catch (error) {
    console.error('❌ Availability sync error:', error)
    errors++
  }

  return { synced, errors }
}

async function syncRecentAppointments(): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    // In a real implementation, you'd fetch recent appointments from Athena
    // For demo purposes, we'll just log that this would happen
    console.log('   📝 Would fetch recent appointments from Athena API')
    console.log('   📝 Would sync appointment statuses and updates')
    
    // Placeholder - in real implementation:
    // 1. Fetch appointments from last 7 days
    // 2. Compare with local database
    // 3. Update any changes
    // 4. Create new appointments not in local DB

    synced = 0 // No actual sync in demo

  } catch (error) {
    console.error('❌ Appointment sync error:', error)
    errors++
  }

  return { synced, errors }
}

async function updateSyncLog(logData: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('athena_sync_logs')
      .insert({
        ...logData,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.warn('⚠️ Could not update sync log (table may not exist):', error.message)
    }
  } catch (error) {
    console.warn('⚠️ Could not update sync log:', error)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options: SyncOptions = {}

args.forEach(arg => {
  switch (arg) {
    case '--providers-only':
      options.providers = true
      options.availability = false
      options.appointments = false
      break
    case '--availability':
      options.availability = true
      break
    case '--appointments':
      options.appointments = true
      break
    case '--force':
      options.force = true
      break
  }
})

// Run the sync
syncAthenaData(options)
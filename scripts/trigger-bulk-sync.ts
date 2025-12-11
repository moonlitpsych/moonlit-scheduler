/**
 * Trigger bulk sync to fix misclassified appointments
 *
 * This script calls the sync service directly to update all appointments
 * with the correct service_instance_id based on IntakeQ's ServiceId field.
 *
 * Usage: npx tsx scripts/trigger-bulk-sync.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { practiceQSyncService } from '../src/lib/services/practiceQSyncService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('🔄 Starting bulk sync to fix appointment classifications...\n')

  const startTime = Date.now()
  let totalNew = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalErrors = 0
  let patientsProcessed = 0

  // Get all patients with IntakeQ appointments
  const { data: patients, error } = await supabaseAdmin
    .from('patients')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .not('email', 'is', null)

  if (error || !patients) {
    console.error('Failed to fetch patients:', error)
    process.exit(1)
  }

  console.log(`📊 Found ${patients.length} active patients\n`)

  for (const patient of patients) {
    try {
      console.log(`🔄 Syncing: ${patient.first_name} ${patient.last_name}`)

      const result = await practiceQSyncService.syncPatientAppointments(
        patient.id,
        null, // null org for admin access
        {
          // Last 1 year + next 90 days
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      )

      totalNew += result.summary.new
      totalUpdated += result.summary.updated
      totalUnchanged += result.summary.unchanged
      totalErrors += result.summary.errors
      patientsProcessed++

      if (result.summary.updated > 0 || result.summary.new > 0) {
        console.log(`   ✅ ${result.summary.new} new, ${result.summary.updated} updated`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`)
      totalErrors++
    }
  }

  const duration = (Date.now() - startTime) / 1000

  console.log('\n✅ Bulk sync completed!')
  console.log(`   📊 Patients: ${patientsProcessed}/${patients.length}`)
  console.log(`   ✨ Appointments: ${totalNew} new, ${totalUpdated} updated, ${totalUnchanged} unchanged`)
  console.log(`   ❌ Errors: ${totalErrors}`)
  console.log(`   ⏱️  Duration: ${duration.toFixed(1)}s`)
}

main().catch(console.error)

/**
 * Run Migration 016: Backfill primary_provider_id
 * This migration assigns each patient to their primary provider based on appointment history
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Running Migration 016: Backfill primary_provider_id\n')
  console.log('This will assign each patient to their primary provider based on appointment history.\n')

  try {
    // Step 1: Get all patients without primary_provider_id
    console.log('📊 Fetching patients without primary provider...')
    const { data: patientsWithoutProvider, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .is('primary_provider_id', null)

    if (patientError) {
      console.error('❌ Error fetching patients:', patientError.message)
      process.exit(1)
    }

    console.log(`   Found ${patientsWithoutProvider?.length || 0} patients without primary provider\n`)

    if (!patientsWithoutProvider || patientsWithoutProvider.length === 0) {
      console.log('✅ All patients already have primary providers assigned!')
      return
    }

    // Step 2: For each patient, find their primary provider from appointments
    console.log('🔍 Calculating primary provider for each patient...\n')
    let updatedCount = 0
    let skippedCount = 0

    for (const patient of patientsWithoutProvider) {
      // Get all appointments for this patient
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('provider_id, start_time, status')
        .eq('patient_id', patient.id)
        .not('provider_id', 'is', null)
        .in('status', ['completed', 'confirmed', 'scheduled'])
        .order('start_time', { ascending: false })

      if (apptError || !appointments || appointments.length === 0) {
        skippedCount++
        continue
      }

      // Count appointments per provider
      const providerCounts = appointments.reduce((acc, appt) => {
        const pid = appt.provider_id
        if (!acc[pid]) {
          acc[pid] = { count: 0, lastDate: appt.start_time }
        }
        acc[pid].count++
        if (new Date(appt.start_time) > new Date(acc[pid].lastDate)) {
          acc[pid].lastDate = appt.start_time
        }
        return acc
      }, {} as Record<string, { count: number; lastDate: string }>)

      // Find the provider with most appointments (and most recent if tied)
      const primaryProviderId = Object.entries(providerCounts)
        .sort(([, a], [, b]) => {
          if (b.count !== a.count) return b.count - a.count
          return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
        })[0][0]

      // Update patient
      const { error: updateError } = await supabase
        .from('patients')
        .update({ primary_provider_id: primaryProviderId })
        .eq('id', patient.id)

      if (updateError) {
        console.error(`   ⚠️  Failed to update ${patient.first_name} ${patient.last_name}:`, updateError.message)
        skippedCount++
      } else {
        console.log(`   ✓ ${patient.first_name} ${patient.last_name} → Provider ${primaryProviderId.substring(0, 8)}...`)
        updatedCount++
      }
    }

    console.log(`\n✅ Migration completed!`)
    console.log(`   Updated: ${updatedCount} patients`)
    console.log(`   Skipped: ${skippedCount} patients (no appointments)\n`)

    // Verify results
    console.log('📊 Checking results...\n')

    const { data: patients, error: verifyError } = await supabase
      .from('patients')
      .select('id, first_name, last_name, primary_provider_id, providers!patients_primary_provider_id_fkey(first_name, last_name)')
      .not('primary_provider_id', 'is', null)
      .limit(10)

    if (verifyError) {
      console.error('⚠️  Could not verify results:', verifyError.message)
    } else {
      console.log(`✅ ${patients?.length || 0} patients now have primary providers assigned`)

      if (patients && patients.length > 0) {
        console.log('\n📋 Sample assignments:')
        patients.forEach((p: any) => {
          const provider = p.providers
          console.log(`   - ${p.first_name} ${p.last_name} → Dr. ${provider?.last_name || 'Unknown'}`)
        })
      }
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .not('primary_provider_id', 'is', null)

    if (!countError) {
      console.log(`\n📈 Total patients with primary provider: ${count}`)
    }

  } catch (err: any) {
    console.error('❌ Error running migration:', err.message)
    console.log('\n💡 Please run this migration manually in the Supabase SQL editor.')
    console.log('   Open: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new')
    process.exit(1)
  }
}

runMigration()

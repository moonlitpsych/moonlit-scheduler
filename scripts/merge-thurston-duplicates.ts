#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DUPLICATE_ID = '89314787-dfb9-483e-905e-1dc04f3f8b23' // erica thurston (lowercase)
const KEEP_ID = '1a75a7ee-db87-4e8d-8baf-5849cd67e15e'      // Erica Thurston (capitalized)

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(question + ' (yes/no): ', (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes')
    })
  })
}

async function mergeDuplicates() {
  console.log('🔍 Merging Duplicate Thurston Patient Records\n')

  // 1. Fetch both patient records
  const { data: duplicate } = await supabase
    .from('patients')
    .select('*')
    .eq('id', DUPLICATE_ID)
    .single()

  const { data: keepRecord } = await supabase
    .from('patients')
    .select('*')
    .eq('id', KEEP_ID)
    .single()

  if (!duplicate || !keepRecord) {
    console.error('❌ Could not find one or both patient records')
    return
  }

  console.log('📋 DUPLICATE RECORD (will be removed):')
  console.log(`   ID: ${duplicate.id}`)
  console.log(`   Name: ${duplicate.first_name} ${duplicate.last_name}`)
  console.log(`   Email: ${duplicate.email}`)
  console.log('')

  console.log('✅ KEEP RECORD (will be updated):')
  console.log(`   ID: ${keepRecord.id}`)
  console.log(`   Name: ${keepRecord.first_name} ${keepRecord.last_name}`)
  console.log(`   Email: ${keepRecord.email}`)
  console.log('')

  // 2. Get appointments for both
  const { data: duplicateAppts } = await supabase
    .from('appointments')
    .select('id, start_time, status')
    .eq('patient_id', DUPLICATE_ID)

  const { data: keepAppts } = await supabase
    .from('appointments')
    .select('id, start_time, status')
    .eq('patient_id', KEEP_ID)

  console.log(`📅 Appointments to move: ${duplicateAppts?.length || 0}`)
  duplicateAppts?.forEach(apt => {
    console.log(`   - ${apt.start_time} (${apt.status})`)
  })

  console.log(`\n📅 Appointments in keep record: ${keepAppts?.length || 0}`)
  console.log('')

  // 3. Ask for confirmation
  const confirmed = await askConfirmation(
    `\n⚠️  This will:\n` +
    `   1. Move ${duplicateAppts?.length || 0} appointment(s) from duplicate to keep record\n` +
    `   2. Normalize name to "Erica Thurston" (proper capitalization)\n` +
    `   3. Use email: ${keepRecord.email}\n` +
    `   4. Mark duplicate record as inactive\n\n` +
    `Continue?`
  )

  if (!confirmed) {
    console.log('\n❌ Merge cancelled by user')
    return
  }

  console.log('\n🔄 Starting merge...\n')

  // 4. Update duplicate's appointments to point to keep record
  if (duplicateAppts && duplicateAppts.length > 0) {
    const { error: moveError } = await supabase
      .from('appointments')
      .update({ patient_id: KEEP_ID })
      .eq('patient_id', DUPLICATE_ID)

    if (moveError) {
      console.error('❌ Error moving appointments:', moveError.message)
      return
    }

    console.log(`✅ Moved ${duplicateAppts.length} appointment(s) to keep record`)
  }

  // 5. Normalize the keep record name
  const { error: updateError } = await supabase
    .from('patients')
    .update({
      first_name: 'Erica',
      last_name: 'Thurston'
    })
    .eq('id', KEEP_ID)

  if (updateError) {
    console.error('❌ Error normalizing name:', updateError.message)
    return
  }

  console.log('✅ Normalized name to "Erica Thurston"')

  // 6. Mark duplicate as inactive in engagement status table
  const { error: inactiveError } = await supabase
    .from('patient_engagement_status')
    .upsert({
      patient_id: DUPLICATE_ID,
      status: 'inactive',
      effective_date: new Date().toISOString(),
      changed_by_email: 'admin@trymoonlit.com',
      change_reason: 'Duplicate patient record merged'
    })

  if (inactiveError) {
    console.error('❌ Error marking duplicate inactive:', inactiveError.message)
    return
  }

  console.log('✅ Marked duplicate record as inactive')

  // 6b. Refresh the materialized view
  const { error: refreshError } = await supabase.rpc('refresh_patient_activity_summary')

  if (refreshError) {
    console.warn('⚠️  Warning: Could not refresh materialized view:', refreshError.message)
    console.log('   View will be updated on next automatic refresh')
  } else {
    console.log('✅ Refreshed patient activity view')
  }

  // 7. Verify final state
  const { data: finalAppts } = await supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', KEEP_ID)

  console.log(`\n📊 MERGE COMPLETE`)
  console.log(`   Kept Patient ID: ${KEEP_ID}`)
  console.log(`   Name: Erica Thurston`)
  console.log(`   Email: ${keepRecord.email}`)
  console.log(`   Total Appointments: ${finalAppts?.length || 0}`)
  console.log(`   Duplicate Record: Marked as inactive`)
  console.log('')
  console.log('✅ Duplicate patient records successfully merged!')
}

mergeDuplicates()

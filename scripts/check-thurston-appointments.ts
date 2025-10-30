#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkThurstonAppointments() {
  const thurstonIds = [
    '89314787-dfb9-483e-905e-1dc04f3f8b23', // erica thurston (lowercase)
    '1a75a7ee-db87-4e8d-8baf-5849cd67e15e'  // Erica Thurston (capitalized)
  ]

  console.log('🔍 Checking appointments for Thurston patients...\n')

  for (const patientId of thurstonIds) {
    // Get patient details
    const { data: patient } = await supabase
      .from('patients')
      .select('first_name, last_name, email')
      .eq('id', patientId)
      .single()

    console.log(`📋 Patient: ${patient?.first_name} ${patient?.last_name} (${patient?.email})`)
    console.log(`   ID: ${patientId}`)

    // Get appointments
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, start_time, status, provider_id, payer_id')
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false })

    if (error) {
      console.error('   ❌ Error fetching appointments:', error.message)
      continue
    }

    if (!appointments || appointments.length === 0) {
      console.log('   ❌ No appointments found\n')
      continue
    }

    console.log(`   ✅ Found ${appointments.length} appointment(s):`)
    appointments.forEach((apt, idx) => {
      console.log(`      ${idx + 1}. ${apt.start_time} - Status: ${apt.status}`)
      console.log(`         Appointment ID: ${apt.id}`)
    })
    console.log('')
  }

  // Now search the finance view
  console.log('\n🔍 Checking v_appointments_grid view for Thurston...\n')

  const { data: gridData, error: gridError } = await supabase
    .from('v_appointments_grid')
    .select('appointment_id, patient, date, service')
    .or(`patient_id.eq.${thurstonIds[0]},patient_id.eq.${thurstonIds[1]}`)
    .order('date', { ascending: false })

  if (gridError) {
    console.error('❌ Error querying grid view:', gridError.message)
  } else if (!gridData || gridData.length === 0) {
    console.log('❌ No records found in v_appointments_grid for Thurston patients')
  } else {
    console.log(`✅ Found ${gridData.length} record(s) in v_appointments_grid:`)
    gridData.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.patient}`)
      console.log(`      Date: ${row.date}, Service: ${row.service}`)
    })
  }
}

checkThurstonAppointments()

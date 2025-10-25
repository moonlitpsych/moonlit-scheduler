/**
 * Debug Endpoint: Verify Patient Schema
 *
 * Checks current schema for patients and appointments tables
 * to inform patient engagement status migration (Migration 019)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: []
    }

    // 1. Check patients table columns
    const { data: patientsColumns, error: patientsError } = await supabase.rpc('get_table_columns', {
      table_name: 'patients'
    })

    if (patientsError) {
      // Fallback: Try direct query
      const { data: patientSample } = await supabase
        .from('patients')
        .select('*')
        .limit(1)

      results.checks.push({
        check: 'patients_table_columns',
        method: 'direct_query',
        columns: patientSample ? Object.keys(patientSample[0] || {}) : [],
        has_status: patientSample ? 'status' in (patientSample[0] || {}) : false,
        has_practiceq_id: patientSample ? 'practiceq_id' in (patientSample[0] || {}) : false
      })
    } else {
      results.checks.push({
        check: 'patients_table_columns',
        method: 'rpc',
        columns: patientsColumns
      })
    }

    // 2. Check appointments table columns and status values
    const { data: appointmentsSample } = await supabase
      .from('appointments')
      .select('*')
      .limit(1)

    results.checks.push({
      check: 'appointments_table_columns',
      columns: appointmentsSample ? Object.keys(appointmentsSample[0] || {}) : [],
      has_status: appointmentsSample ? 'status' in (appointmentsSample[0] || {}) : false
    })

    // 3. Get distinct appointment status values
    const { data: statusValues } = await supabase
      .from('appointments')
      .select('status')
      .limit(100)

    const uniqueStatuses = [...new Set(statusValues?.map(s => s.status) || [])]

    results.checks.push({
      check: 'appointment_status_values',
      unique_values: uniqueStatuses,
      sample_count: statusValues?.length || 0
    })

    // 4. Check if patient_engagement_status table already exists
    const { data: existingTable, error: tableError } = await supabase
      .from('patient_engagement_status')
      .select('*')
      .limit(1)

    results.checks.push({
      check: 'patient_engagement_status_table',
      exists: !tableError,
      error: tableError?.message || null
    })

    // 5. Sample appointments to understand data structure
    const { data: appointmentData } = await supabase
      .from('appointments')
      .select('id, patient_id, provider_id, start_time, status')
      .order('start_time', { ascending: false })
      .limit(5)

    results.checks.push({
      check: 'recent_appointments_sample',
      count: appointmentData?.length || 0,
      sample: appointmentData
    })

    // 6. Test query for "last seen" logic
    const { data: completedAppts, error: completedError } = await supabase
      .from('appointments')
      .select('patient_id, start_time, status')
      .in('status', ['kept', 'completed'])
      .order('start_time', { ascending: false })
      .limit(3)

    results.checks.push({
      check: 'completed_appointments_query',
      success: !completedError,
      sample_count: completedAppts?.length || 0,
      sample: completedAppts,
      error: completedError?.message || null
    })

    // 7. Test query for "next appointment" logic
    const { data: futureAppts, error: futureError } = await supabase
      .from('appointments')
      .select('patient_id, start_time, status')
      .gte('start_time', new Date().toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .order('start_time', { ascending: true })
      .limit(3)

    results.checks.push({
      check: 'future_appointments_query',
      success: !futureError,
      sample_count: futureAppts?.length || 0,
      sample: futureAppts,
      error: futureError?.message || null
    })

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

import { supabaseAdmin } from '../src/lib/supabase'

async function investigatePatient() {
  const email = 'cthaynes28@gmail.com'
  console.log(`🔍 Investigating booking attempts for: ${email}\n`)
  console.log('='.repeat(80))

  // 1. Check if patient exists
  console.log('\n👤 CHECKING PATIENT RECORD...\n')

  const { data: patients, error: patientError } = await supabaseAdmin
    .from('patients')
    .select('*')
    .eq('email', email)

  if (patientError) {
    console.error('❌ Error fetching patient:', patientError)
  } else if (!patients || patients.length === 0) {
    console.log('❌ No patient record found for this email')
    console.log('   This suggests the booking never reached the database.')
  } else {
    console.log(`✅ Found ${patients.length} patient record(s):\n`)
    patients.forEach(p => {
      console.log(`Patient ID: ${p.id}`)
      console.log(`Name: ${p.first_name} ${p.last_name}`)
      console.log(`Email: ${p.email}`)
      console.log(`Phone: ${p.phone || 'Not provided'}`)
      console.log(`DOB: ${p.date_of_birth || 'Not provided'}`)
      console.log(`Created: ${p.created_at}`)
      console.log(`Status: ${p.status}`)
      console.log('---\n')
    })

    // 2. Check for appointments
    console.log('📅 CHECKING APPOINTMENTS...\n')

    const patientIds = patients.map(p => p.id)

    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        patient_id,
        provider_id,
        payer_id,
        start_time,
        end_time,
        status,
        pq_appointment_id,
        created_at,
        notes,
        booking_source,
        providers:provider_id (
          first_name,
          last_name
        ),
        payers:payer_id (
          name
        )
      `)
      .in('patient_id', patientIds)
      .order('created_at', { ascending: false })

    if (apptError) {
      console.error('❌ Error fetching appointments:', apptError)
    } else if (!appointments || appointments.length === 0) {
      console.log('❌ No appointments found for this patient')
      console.log('   The patient record exists but no appointment was created.')
      console.log('   This suggests the error occurred during appointment creation.')
    } else {
      console.log(`✅ Found ${appointments.length} appointment(s):\n`)

      appointments.forEach(apt => {
        const provider = apt.providers as any
        const payer = apt.payers as any
        const isFriday = new Date(apt.created_at).getDay() === 5

        console.log(`${'='.repeat(80)}`)
        console.log(`Appointment ID: ${apt.id}`)
        console.log(`Created: ${apt.created_at} ${isFriday ? '⭐ FRIDAY' : ''}`)
        console.log(`Status: ${apt.status}`)
        console.log(`Provider: ${provider?.first_name} ${provider?.last_name}`)
        console.log(`Payer: ${payer?.name || 'Not specified'}`)
        console.log(`Start Time: ${apt.start_time}`)
        console.log(`End Time: ${apt.end_time}`)
        console.log(`PQ Appointment ID: ${apt.pq_appointment_id || '❌ NOT SET'}`)
        console.log(`Booking Source: ${apt.booking_source || 'Not specified'}`)
        console.log(`\nNotes:`)
        console.log(apt.notes || 'No notes')
        console.log(`${'='.repeat(80)}\n`)
      })

      // Check for Friday appointments specifically
      const fridayAppointments = appointments.filter(apt => {
        const createdDate = new Date(apt.created_at)
        return createdDate.getDay() === 5 && createdDate >= new Date('2025-10-18')
      })

      if (fridayAppointments.length > 0) {
        console.log(`\n⭐ ${fridayAppointments.length} appointment(s) created on Friday (Oct 18)`)
      }
    }
  }

  // 3. Check idempotency requests table for this email
  console.log('\n\n🔑 CHECKING IDEMPOTENCY REQUESTS...\n')

  const { data: idempotencyRequests, error: idempotencyError } = await supabaseAdmin
    .from('idempotency_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (idempotencyError) {
    console.error('❌ Error fetching idempotency requests:', idempotencyError)
  } else {
    // Filter by email in the request payload
    const matchingRequests = (idempotencyRequests || []).filter(req => {
      const payload = req.request_payload as any
      return payload?.patient?.email === email ||
             payload?.email === email
    })

    if (matchingRequests.length === 0) {
      console.log('No idempotency requests found for this email')
    } else {
      console.log(`Found ${matchingRequests.length} idempotency request(s):\n`)
      matchingRequests.forEach(req => {
        console.log(`Key: ${req.key}`)
        console.log(`Appointment ID: ${req.appointment_id}`)
        console.log(`Created: ${req.created_at}`)
        console.log(`Request Payload:`, JSON.stringify(req.request_payload, null, 2))
        console.log('---\n')
      })
    }
  }

  // 4. Check IntakeQ audit logs
  console.log('\n\n📋 CHECKING INTAKEQ SYNC LOGS...\n')

  const { data: auditLogs, error: auditError } = await supabaseAdmin
    .from('intakeq_sync_log')
    .select('*')
    .gte('created_at', '2025-10-18T00:00:00Z')
    .order('created_at', { ascending: false })

  if (auditError) {
    console.error('❌ Error fetching audit logs:', auditError)
  } else if (!auditLogs || auditLogs.length === 0) {
    console.log('No IntakeQ sync logs found since Friday')
  } else {
    console.log(`Found ${auditLogs.length} IntakeQ sync logs since Friday\n`)

    // Check if any contain our email
    const relevantLogs = auditLogs.filter(log => {
      const payload = log.payload as any
      const response = log.response as any
      return JSON.stringify(log).toLowerCase().includes(email.toLowerCase())
    })

    if (relevantLogs.length > 0) {
      console.log(`⭐ Found ${relevantLogs.length} logs related to ${email}:\n`)
      relevantLogs.forEach(log => {
        console.log(`Action: ${log.action}`)
        console.log(`Status: ${log.status}`)
        console.log(`Created: ${log.created_at}`)
        console.log(`Appointment ID: ${log.appointment_id || 'N/A'}`)
        console.log(`IntakeQ Client ID: ${log.intakeq_client_id || 'N/A'}`)
        console.log(`Error: ${log.error || 'None'}`)
        console.log('---\n')
      })
    } else {
      console.log('No logs specifically related to this email')
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('🔍 INVESTIGATION COMPLETE')
  console.log('='.repeat(80))
}

investigatePatient()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Investigation failed:', err)
    process.exit(1)
  })

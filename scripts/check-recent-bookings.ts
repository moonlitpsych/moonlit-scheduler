import { supabaseAdmin } from '../src/lib/supabase'

async function checkRecentBookings() {
  console.log('🔍 Checking recent bookings for errors...\n')

  // Get today's date in Mountain Time
  const now = new Date()
  const mtOffset = -6 // MDT
  const mtNow = new Date(now.getTime() + (mtOffset * 60 * 60 * 1000))
  const todayMT = mtNow.toISOString().split('T')[0]

  console.log(`📅 Checking appointments from ${todayMT}`)

  // Query recent appointments
  const { data: appointments, error } = await supabaseAdmin
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
      patients:patient_id (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      providers:provider_id (
        id,
        first_name,
        last_name
      ),
      payers:payer_id (
        id,
        name
      )
    `)
    .gte('created_at', `${todayMT}T00:00:00Z`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching appointments:', error)
    return
  }

  console.log(`\n📊 Found ${appointments?.length || 0} appointments today\n`)

  if (!appointments || appointments.length === 0) {
    console.log('No appointments found for today')
    return
  }

  // Group by status
  const byStatus = appointments.reduce((acc, apt) => {
    const status = apt.status || 'unknown'
    if (!acc[status]) acc[status] = []
    acc[status].push(apt)
    return acc
  }, {} as Record<string, typeof appointments>)

  console.log('Status Breakdown:')
  Object.entries(byStatus).forEach(([status, apts]) => {
    console.log(`  ${status}: ${apts.length}`)
  })

  // Show error appointments in detail
  if (byStatus['error']) {
    console.log('\n❌ ERROR APPOINTMENTS:\n')
    byStatus['error'].forEach((apt) => {
      const patient = apt.patients as any
      const provider = apt.providers as any
      const payer = apt.payers as any

      console.log(`Appointment ID: ${apt.id}`)
      console.log(`Created: ${apt.created_at}`)
      console.log(`Patient: ${patient?.first_name} ${patient?.last_name} (${patient?.email})`)
      console.log(`Provider: ${provider?.first_name} ${provider?.last_name}`)
      console.log(`Payer: ${payer?.name}`)
      console.log(`Start: ${apt.start_time}`)
      console.log(`PQ Appointment ID: ${apt.pq_appointment_id || 'NOT SET'}`)
      console.log(`Notes: ${apt.notes}`)
      console.log('---\n')
    })
  }

  // Show appointments missing pq_appointment_id
  const missingPqId = appointments.filter(apt => !apt.pq_appointment_id && apt.status !== 'error')
  if (missingPqId.length > 0) {
    console.log(`\n⚠️ ${missingPqId.length} APPOINTMENTS WITHOUT IntakeQ ID:\n`)
    missingPqId.forEach((apt) => {
      const patient = apt.patients as any
      const provider = apt.providers as any

      console.log(`Appointment ID: ${apt.id}`)
      console.log(`Status: ${apt.status}`)
      console.log(`Created: ${apt.created_at}`)
      console.log(`Patient: ${patient?.first_name} ${patient?.last_name} (${patient?.email})`)
      console.log(`Provider: ${provider?.first_name} ${provider?.last_name}`)
      console.log(`Notes snippet: ${apt.notes?.substring(0, 100)}...`)
      console.log('---\n')
    })
  }

  // Show successful bookings
  if (byStatus['scheduled']) {
    console.log(`\n✅ ${byStatus['scheduled'].length} SUCCESSFULLY SCHEDULED APPOINTMENTS:\n`)
    byStatus['scheduled'].slice(0, 5).forEach((apt) => {
      const patient = apt.patients as any
      const provider = apt.providers as any

      console.log(`Appointment ID: ${apt.id}`)
      console.log(`PQ ID: ${apt.pq_appointment_id || 'MISSING'}`)
      console.log(`Created: ${apt.created_at}`)
      console.log(`Patient: ${patient?.first_name} ${patient?.last_name}`)
      console.log(`Provider: ${provider?.first_name} ${provider?.last_name}`)
      console.log('---\n')
    })
  }
}

checkRecentBookings()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err)
    process.exit(1)
  })

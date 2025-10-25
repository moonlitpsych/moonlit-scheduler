import { supabaseAdmin } from '../src/lib/supabase'

async function checkRecentDays() {
  console.log('🔍 Checking last 3 days of bookings...\n')

  // Get date 3 days ago
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const startDate = threeDaysAgo.toISOString()

  console.log(`📅 Checking from ${startDate}`)

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
        email
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
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('❌ Error fetching appointments:', error)
    return
  }

  console.log(`\n📊 Found ${appointments?.length || 0} recent appointments\n`)

  if (!appointments || appointments.length === 0) {
    console.log('No appointments found')
    return
  }

  // Show appointments with status 'scheduled' or 'error' or missing pq_appointment_id
  const interesting = appointments.filter(apt =>
    apt.status === 'scheduled' ||
    apt.status === 'error' ||
    !apt.pq_appointment_id
  )

  console.log(`🔍 ${interesting.length} appointments need attention:\n`)

  interesting.forEach((apt) => {
    const patient = apt.patients as any
    const provider = apt.providers as any
    const payer = apt.payers as any

    console.log(`\n${'='.repeat(80)}`)
    console.log(`Appointment ID: ${apt.id}`)
    console.log(`Status: ${apt.status}`)
    console.log(`Created: ${apt.created_at}`)
    console.log(`Patient: ${patient?.first_name} ${patient?.last_name} (${patient?.email})`)
    console.log(`Provider: ${provider?.first_name} ${provider?.last_name}`)
    console.log(`Payer: ${payer?.name}`)
    console.log(`Start Time: ${apt.start_time}`)
    console.log(`PQ Appointment ID: ${apt.pq_appointment_id || '❌ NOT SET'}`)
    console.log(`Booking Source: ${apt.booking_source}`)
    console.log(`\nNotes:`)
    console.log(apt.notes || 'No notes')
    console.log(`${'='.repeat(80)}`)
  })

  // Show status breakdown
  const byStatus = appointments.reduce((acc, apt) => {
    const status = apt.status || 'unknown'
    if (!acc[status]) acc[status] = 0
    acc[status]++
    return acc
  }, {} as Record<string, number>)

  console.log('\n\n📊 Status Breakdown (last 50 appointments):')
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
}

checkRecentDays()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err)
    process.exit(1)
  })

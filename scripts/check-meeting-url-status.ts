/**
 * Check Meeting URL Population Status
 *
 * Analyzes how many appointments have meeting_url and location_info populated
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMeetingUrlStatus() {
  console.log('🔍 Checking meeting URL population status...\n')

  // Get all appointments from last 30 days and next 90 days
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 90)

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, start_time, status, meeting_url, location_info, location_type')
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: false })

  if (error) {
    console.error('❌ Error fetching appointments:', error)
    return
  }

  if (!appointments || appointments.length === 0) {
    console.log('⚠️  No appointments found in date range')
    return
  }

  console.log(`📊 Analysis of ${appointments.length} appointments:\n`)

  // Count by various criteria
  const totalAppointments = appointments.length
  const withMeetingUrl = appointments.filter(a => a.meeting_url).length
  const withLocationInfo = appointments.filter(a => a.location_info).length
  const telehealth = appointments.filter(a => a.location_type === 'telehealth' || a.location_info?.locationType === 'telehealth').length
  const telehealthWithUrl = appointments.filter(a =>
    (a.location_type === 'telehealth' || a.location_info?.locationType === 'telehealth') &&
    a.meeting_url
  ).length

  console.log('Overall Statistics:')
  console.log(`  Total appointments: ${totalAppointments}`)
  console.log(`  With meeting_url: ${withMeetingUrl} (${((withMeetingUrl/totalAppointments)*100).toFixed(1)}%)`)
  console.log(`  With location_info: ${withLocationInfo} (${((withLocationInfo/totalAppointments)*100).toFixed(1)}%)`)
  console.log(`  Telehealth appointments: ${telehealth}`)
  console.log(`  Telehealth with meeting URL: ${telehealthWithUrl} (${telehealth > 0 ? ((telehealthWithUrl/telehealth)*100).toFixed(1) : 0}%)\n`)

  // Show sample appointments with meeting URLs
  const samplesWithUrl = appointments.filter(a => a.meeting_url).slice(0, 5)
  if (samplesWithUrl.length > 0) {
    console.log('✅ Sample appointments WITH meeting URLs:')
    samplesWithUrl.forEach(appt => {
      console.log(`  - ${new Date(appt.start_time).toLocaleString()}: ${appt.meeting_url}`)
    })
    console.log('')
  }

  // Show sample telehealth appointments without meeting URLs
  const telehealthWithoutUrl = appointments.filter(a =>
    (a.location_type === 'telehealth' || a.location_info?.locationType === 'telehealth') &&
    !a.meeting_url
  ).slice(0, 5)

  if (telehealthWithoutUrl.length > 0) {
    console.log('⚠️  Sample TELEHEALTH appointments WITHOUT meeting URLs:')
    telehealthWithoutUrl.forEach(appt => {
      console.log(`  - ${new Date(appt.start_time).toLocaleString()}: ${appt.status}`)
      console.log(`    location_info: ${JSON.stringify(appt.location_info)}`)
    })
    console.log('')
  }

  // Analyze location_info structure
  const locationInfoSamples = appointments.filter(a => a.location_info).slice(0, 3)
  if (locationInfoSamples.length > 0) {
    console.log('📍 Sample location_info structures:')
    locationInfoSamples.forEach(appt => {
      console.log(`  ${JSON.stringify(appt.location_info, null, 2)}`)
    })
    console.log('')
  }

  // Final recommendation
  console.log('💡 Recommendation:')
  if (withMeetingUrl === 0) {
    console.log('  ❌ NO meeting URLs found in database')
    console.log('  → Need to fix PracticeQ sync to populate meeting_url field')
    console.log('  → IntakeQ API may not expose TelehealthInfo')
    console.log('  → Consider alternative approaches (see GOOGLE_MEET_LINKS_SOLUTION.md)')
  } else if (telehealthWithUrl < telehealth * 0.5) {
    console.log('  ⚠️  Meeting URLs partially populated')
    console.log(`  → Only ${telehealthWithUrl}/${telehealth} telehealth appointments have URLs`)
    console.log('  → Fix PracticeQ sync AND update calendar feed')
  } else {
    console.log('  ✅ Meeting URLs are being populated!')
    console.log('  → Just need to update calendar feed API to include them')
    console.log('  → See GOOGLE_MEET_LINKS_SOLUTION.md for implementation steps')
  }
}

checkMeetingUrlStatus()
  .then(() => {
    console.log('\n✅ Analysis complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })

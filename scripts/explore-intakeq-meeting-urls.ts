/**
 * Explore IntakeQ Appointment API Response
 *
 * Purpose: Discover what fields IntakeQ provides for:
 * - Video conferencing / Google Meet links
 * - Location information (address, location name)
 * - Service details
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const intakeqApiKey = process.env.INTAKEQ_API_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function exploreIntakeQMeetingData() {
  console.log('🔍 Exploring IntakeQ Appointment Data for Meeting URLs and Locations...\n')

  // Get a few recent appointments with PracticeQ IDs
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, pq_appointment_id, start_time, patient_id')
    .not('pq_appointment_id', 'is', null)
    .order('start_time', { ascending: false })
    .limit(3)

  if (error || !appointments || appointments.length === 0) {
    console.error('❌ Error fetching appointments:', error)
    return
  }

  console.log(`📍 Found ${appointments.length} appointments to check\n`)

  for (const appt of appointments) {
    console.log('═'.repeat(80))
    console.log(`\n🗓️  Appointment ID: ${appt.pq_appointment_id}`)
    console.log(`   Start Time: ${appt.start_time}`)
    console.log()

    try {
      // Fetch full appointment details from IntakeQ
      const response = await fetch(
        `https://intakeq.com/api/v1/appointments/${appt.pq_appointment_id}`,
        {
          method: 'GET',
          headers: {
            'X-Auth-Key': intakeqApiKey,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error(`   ❌ API error: ${response.status}`)
        continue
      }

      const data = await response.json()

      // Log all top-level keys
      console.log('   📋 All fields in response:')
      Object.keys(data).sort().forEach(key => {
        const value = data[key]
        const type = Array.isArray(value) ? 'array' : typeof value
        let preview = ''

        if (type === 'array') {
          preview = `Array(${value.length})`
        } else if (type === 'object' && value !== null) {
          preview = 'Object'
        } else if (type === 'string') {
          preview = value.substring(0, 60) + (value.length > 60 ? '...' : '')
        } else {
          preview = String(value)
        }

        console.log(`      ${key.padEnd(30)} (${type.padEnd(8)}) ${preview}`)
      })

      // Look for video/meeting related fields
      console.log('\n   🎥 Video/Meeting Fields:')
      const videoFields = Object.keys(data).filter(key =>
        key.toLowerCase().includes('video') ||
        key.toLowerCase().includes('meet') ||
        key.toLowerCase().includes('conferencing') ||
        key.toLowerCase().includes('link') ||
        key.toLowerCase().includes('url')
      )

      if (videoFields.length > 0) {
        videoFields.forEach(key => {
          console.log(`      ✅ ${key}: ${JSON.stringify(data[key])}`)
        })
      } else {
        console.log('      ⚠️  No video/meeting fields found')
      }

      // Look for location related fields
      console.log('\n   📍 Location Fields:')
      const locationFields = Object.keys(data).filter(key =>
        key.toLowerCase().includes('location') ||
        key.toLowerCase().includes('address') ||
        key.toLowerCase().includes('place')
      )

      if (locationFields.length > 0) {
        locationFields.forEach(key => {
          const value = data[key]
          if (typeof value === 'object') {
            console.log(`      ✅ ${key}:`, JSON.stringify(value, null, 8))
          } else {
            console.log(`      ✅ ${key}: ${value}`)
          }
        })
      } else {
        console.log('      ⚠️  No location fields found')
      }

      // Check service details
      if (data.Service || data.ServiceName || data.ServiceId) {
        console.log('\n   🏥 Service Info:')
        if (data.Service) {
          console.log('      Service:', JSON.stringify(data.Service, null, 8))
        }
        if (data.ServiceName) {
          console.log('      ServiceName:', data.ServiceName)
        }
        if (data.ServiceId) {
          console.log('      ServiceId:', data.ServiceId)
        }
      }

      // Full raw response (for debugging)
      console.log('\n   📄 Full Raw Response:')
      console.log(JSON.stringify(data, null, 2))

    } catch (error: any) {
      console.error(`   ❌ Error fetching appointment:`, error.message)
    }

    console.log()
  }

  console.log('═'.repeat(80))
  console.log('\n✅ Exploration complete!')
  console.log('\n💡 Next Steps:')
  console.log('   1. Look for fields like: VideoConferencingUrl, MeetingUrl, GoogleMeet, Location')
  console.log('   2. Check if location data is in LocationId (reference) or embedded')
  console.log('   3. Determine if we need to fetch location details separately')
}

exploreIntakeQMeetingData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

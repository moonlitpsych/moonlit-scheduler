#!/usr/bin/env npx tsx
/**
 * Direct bulk sync - calls IntakeQ API directly and updates appointments
 *
 * Usage: INTAKEQ_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx npx tsx scripts/direct-bulk-sync.ts
 */

import { createClient } from '@supabase/supabase-js'

// Read from env file
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars: Record<string, string> = {}
envContent.split('\n').forEach((line: string) => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1]] = match[2]
  }
})

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY
const INTAKEQ_API_KEY = envVars.INTAKEQ_API_KEY || process.env.INTAKEQ_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

if (!INTAKEQ_API_KEY) {
  console.error('Missing IntakeQ API key')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Service instance mapping
const SERVICE_MAPPING: Record<string, string> = {
  '137bcec9-6d59-4cd8-910f-a1d9c0616319': 'Intake',
  '436ebccd-7e5b-402d-9f13-4c5733e3af8c': 'Follow-up (Short)',
  'f0490d0a-992f-4f14-836f-0e41e11be14d': 'Follow-up (Extended)',
  '2d212ea8-de91-4aa9-aff9-9ba0feab0137': 'Intake (alt)',
  '4a8c9634-3449-4fde-94fe-5de7dc6c9dc8': 'Intake (SelectHealth)',
}

async function getServiceInstanceFromIntakeqId(intakeqServiceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('service_instance_integrations')
    .select('service_instance_id')
    .eq('external_id', intakeqServiceId)
    .in('system', ['intakeq', 'practiceq'])
    .limit(1)

  if (error || !data || data.length === 0) {
    return null
  }
  return data[0].service_instance_id
}

async function fetchIntakeqAppointment(appointmentId: string): Promise<any> {
  const response = await fetch(`https://intakeq.com/api/v1/appointments/${appointmentId}`, {
    headers: {
      'X-Auth-Key': INTAKEQ_API_KEY!,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`IntakeQ API error: ${response.status}`)
  }

  return response.json()
}

async function main() {
  console.log('🔄 Starting direct bulk sync to fix appointment classifications...\n')

  const DEFAULT_SERVICE_INSTANCE = '12191f44-a09c-426f-8e22-0c5b8e57b3b7' // Intake

  // Get all appointments with pq_appointment_id that use the default Intake service
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, pq_appointment_id, service_instance_id, start_time')
    .eq('service_instance_id', DEFAULT_SERVICE_INSTANCE)
    .not('pq_appointment_id', 'is', null)
    .order('start_time', { ascending: false })

  if (error) {
    console.error('Failed to fetch appointments:', error)
    process.exit(1)
  }

  console.log(`📊 Found ${appointments?.length || 0} appointments using default Intake service\n`)

  let updated = 0
  let unchanged = 0
  let errors = 0

  for (const appt of appointments || []) {
    try {
      // Fetch from IntakeQ to get ServiceId
      const intakeqAppt = await fetchIntakeqAppointment(appt.pq_appointment_id)

      if (!intakeqAppt.ServiceId) {
        console.log(`⏭️  ${appt.id}: No ServiceId from IntakeQ`)
        unchanged++
        continue
      }

      // Look up service_instance_id from IntakeQ ServiceId
      const newServiceInstanceId = await getServiceInstanceFromIntakeqId(intakeqAppt.ServiceId)

      if (!newServiceInstanceId || newServiceInstanceId === DEFAULT_SERVICE_INSTANCE) {
        console.log(`⏭️  ${appt.id}: Same service (${SERVICE_MAPPING[intakeqAppt.ServiceId] || intakeqAppt.ServiceId})`)
        unchanged++
        continue
      }

      // Update the appointment
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ service_instance_id: newServiceInstanceId })
        .eq('id', appt.id)

      if (updateError) {
        throw updateError
      }

      const serviceName = SERVICE_MAPPING[intakeqAppt.ServiceId] || intakeqAppt.ServiceId
      console.log(`✅ ${appt.id}: Updated to ${serviceName} (${newServiceInstanceId})`)
      updated++

      // Rate limit
      await new Promise(r => setTimeout(r, 200))

    } catch (err: any) {
      console.error(`❌ ${appt.id}: ${err.message}`)
      errors++
    }
  }

  console.log('\n✅ Bulk sync completed!')
  console.log(`   Updated: ${updated}`)
  console.log(`   Unchanged: ${unchanged}`)
  console.log(`   Errors: ${errors}`)
}

main().catch(console.error)

/**
 * Check for appointments in database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAppointments() {
  console.log('🔍 Checking Appointments Database\n')

  // Check total appointments
  const { data: allAppts, error: allError } = await supabase
    .from('appointments')
    .select('id, patient_id, start_time, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (allError) {
    console.error('❌ Error fetching appointments:', allError)
    return
  }

  console.log(`📊 Total recent appointments: ${allAppts?.length || 0}\n`)

  if (allAppts && allAppts.length > 0) {
    console.log('Recent appointments:')
    allAppts.forEach((appt, i) => {
      console.log(`${i + 1}. ${appt.id.substring(0, 8)}... - ${appt.status} - ${new Date(appt.start_time).toLocaleString()}`)
      console.log(`   Patient ID: ${appt.patient_id?.substring(0, 8)}...`)
      console.log(`   Created: ${new Date(appt.created_at).toLocaleString()}`)
    })
  } else {
    console.log('⚠️  No appointments found in database')
  }

  // Check FSH patient IDs
  const FSH_ORG_ID = 'c621d896-de55-4ea7-84c2-a01502249e82'
  const { data: fshAffiliations } = await supabase
    .from('patient_organization_affiliations')
    .select('patient_id')
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')

  const fshPatientIds = fshAffiliations?.map(a => a.patient_id) || []
  console.log(`\n📋 FSH Patient IDs: ${fshPatientIds.length}`)

  if (fshPatientIds.length > 0) {
    // Check appointments for FSH patients
    const { data: fshAppts } = await supabase
      .from('appointments')
      .select('id, patient_id, start_time, status')
      .in('patient_id', fshPatientIds)
      .order('start_time', { ascending: false })

    console.log(`📅 Appointments for FSH patients: ${fshAppts?.length || 0}\n`)

    if (fshAppts && fshAppts.length > 0) {
      fshAppts.forEach((appt, i) => {
        console.log(`${i + 1}. ${new Date(appt.start_time).toLocaleString()} - ${appt.status}`)
        console.log(`   Appt ID: ${appt.id.substring(0, 8)}...`)
        console.log(`   Patient ID: ${appt.patient_id.substring(0, 8)}...`)
      })
    }
  }

  // Check appointments by status
  console.log('\n📊 Appointments by status:')
  const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled']
  for (const status of statuses) {
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)

    console.log(`   ${status}: ${count || 0}`)
  }

  // Check appointments by date range
  const now = new Date()
  const past30Days = new Date()
  past30Days.setDate(past30Days.getDate() - 30)
  const next30Days = new Date()
  next30Days.setDate(next30Days.getDate() + 30)

  const { count: pastCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', past30Days.toISOString())
    .lt('start_time', now.toISOString())

  const { count: futureCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', now.toISOString())
    .lte('start_time', next30Days.toISOString())

  console.log(`\n📅 Appointments by date:`)
  console.log(`   Past 30 days: ${pastCount || 0}`)
  console.log(`   Next 30 days: ${futureCount || 0}`)
}

checkAppointments()

/**
 * Debug FSH Patient Provider Assignments
 * Check what providers should be assigned to FSH patients
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const FSH_ORG_ID = 'c621d896-de55-4ea7-84c2-a01502249e82'

async function debugPatients() {
  console.log('🔍 Debugging FSH Patient Provider Assignments\n')

  // Get all FSH patients
  const { data: affiliations, error: affError } = await supabase
    .from('patient_organization_affiliations')
    .select(`
      id,
      patient_id,
      patients (
        id,
        first_name,
        last_name,
        email,
        primary_provider_id
      )
    `)
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')

  if (affError) {
    console.error('❌ Error fetching affiliations:', affError)
    return
  }

  console.log(`📊 Found ${affiliations?.length || 0} FSH patients\n`)

  // For each patient, check appointments
  for (const aff of affiliations || []) {
    const patient = aff.patients as any

    console.log(`\n👤 ${patient.first_name} ${patient.last_name} (${patient.email})`)
    console.log(`   Current primary_provider_id: ${patient.primary_provider_id || 'NULL'}`)

    // Check appointments
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        provider_id,
        providers!appointments_provider_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq('patient_id', patient.id)
      .order('start_time', { ascending: false })

    if (apptError) {
      console.error('   ❌ Error fetching appointments:', apptError)
      continue
    }

    if (!appointments || appointments.length === 0) {
      console.log('   ⚠️  No appointments found in database')
    } else {
      console.log(`   ✅ Found ${appointments.length} appointment(s):`)
      appointments.forEach(appt => {
        const provider = appt.providers as any
        console.log(`      - ${appt.status} on ${new Date(appt.start_time).toLocaleDateString()} with Dr. ${provider?.last_name || 'Unknown'}`)
      })

      // Show who should be primary
      const providerCounts = appointments
        .filter(a => a.provider_id)
        .reduce((acc, appt) => {
          const pid = appt.provider_id
          if (!acc[pid]) {
            const provider = appt.providers as any
            acc[pid] = {
              id: pid,
              name: `Dr. ${provider?.first_name} ${provider?.last_name}`,
              count: 0,
              lastDate: appt.start_time
            }
          }
          acc[pid].count++
          return acc
        }, {} as Record<string, any>)

      const primary = Object.values(providerCounts).sort((a: any, b: any) => b.count - a.count)[0]
      if (primary) {
        console.log(`   💡 Should be assigned to: ${primary.name} (${primary.count} appointments)`)
      }
    }
  }

  console.log('\n\n📊 Summary:')

  const { data: withProvider, error: wpError } = await supabase
    .from('patient_organization_affiliations')
    .select(`
      patient_id,
      patients!inner (
        id,
        first_name,
        last_name,
        primary_provider_id,
        providers (
          first_name,
          last_name
        )
      )
    `)
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')
    .not('patients.primary_provider_id', 'is', null)

  console.log(`✅ FSH patients WITH providers: ${withProvider?.length || 0}`)

  if (withProvider && withProvider.length > 0) {
    console.log('\nPatients with providers:')
    withProvider.forEach(aff => {
      const patient = aff.patients as any
      const provider = patient.providers as any
      console.log(`   - ${patient.first_name} ${patient.last_name} → Dr. ${provider?.last_name}`)
    })
  }

  const { data: withoutProvider, error: wopError } = await supabase
    .from('patient_organization_affiliations')
    .select(`
      patient_id,
      patients!inner (
        id,
        first_name,
        last_name,
        primary_provider_id
      )
    `)
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')
    .is('patients.primary_provider_id', null)

  console.log(`\n❌ FSH patients WITHOUT providers: ${withoutProvider?.length || 0}`)

  if (withoutProvider && withoutProvider.length > 0) {
    console.log('\nPatients without providers (first 10):')
    withoutProvider.slice(0, 10).forEach(aff => {
      const patient = aff.patients as any
      console.log(`   - ${patient.first_name} ${patient.last_name}`)
    })
  }
}

debugPatients()

import { supabaseAdmin } from '../src/lib/supabase'
import { resolveIntakeServiceInstance } from '../src/lib/services/intakeResolver'
import { getIntakeqPractitionerId } from '../src/lib/integrations/providerMap'
import { getIntakeqServiceId } from '../src/lib/integrations/serviceInstanceMap'

async function diagnoseBookingConfig() {
  console.log('🔍 BOOKING CONFIGURATION DIAGNOSTIC\n')
  console.log('='.repeat(80))

  const issues: string[] = []
  const warnings: string[] = []

  // 1. Check all active bookable payers have intake service instances
  console.log('\n📋 CHECKING PAYER SERVICE INSTANCE MAPPINGS...\n')

  const { data: payers, error: payersError } = await supabaseAdmin
    .from('payers')
    .select('id, name, payer_type')
    .order('name')

  if (payersError) {
    console.error('❌ Failed to fetch payers:', payersError)
    issues.push(`Failed to fetch payers: ${payersError.message}`)
  } else {
    console.log(`Found ${payers?.length || 0} payers\n`)

    for (const payer of payers || []) {
      try {
        const result = await resolveIntakeServiceInstance(payer.id)
        console.log(`✅ ${payer.name}: ${result.serviceInstanceId} (${result.durationMinutes}min)`)
      } catch (error: any) {
        if (error.code === 'NO_INTAKE_INSTANCE_FOR_PAYER') {
          console.log(`❌ ${payer.name}: NO SERVICE INSTANCE MAPPED`)
          issues.push(`Payer "${payer.name}" (${payer.id}) has no intake service instance mapped`)
        } else {
          console.log(`❌ ${payer.name}: ${error.message}`)
          issues.push(`Payer "${payer.name}" error: ${error.message}`)
        }
      }
    }
  }

  // 2. Check all active providers have IntakeQ practitioner mappings
  console.log('\n\n👨‍⚕️ CHECKING PROVIDER INTAKEQ MAPPINGS...\n')

  const { data: providers, error: providersError } = await supabaseAdmin
    .from('providers')
    .select('id, first_name, last_name, is_active, is_bookable')
    .eq('is_active', true)
    .order('last_name')

  if (providersError) {
    console.error('❌ Failed to fetch providers:', providersError)
    issues.push(`Failed to fetch providers: ${providersError.message}`)
  } else {
    console.log(`Found ${providers?.length || 0} active providers\n`)

    for (const provider of providers || []) {
      const name = `${provider.first_name} ${provider.last_name}`
      try {
        const practitionerId = await getIntakeqPractitionerId(provider.id)
        if (provider.is_bookable) {
          console.log(`✅ ${name}: ${practitionerId}`)
        } else {
          console.log(`⚠️  ${name}: ${practitionerId} (not bookable)`)
          warnings.push(`Provider "${name}" has IntakeQ mapping but is not bookable`)
        }
      } catch (error: any) {
        if (provider.is_bookable) {
          console.log(`❌ ${name}: NO INTAKEQ MAPPING`)
          issues.push(`Bookable provider "${name}" (${provider.id}) has no IntakeQ practitioner mapping`)
        } else {
          console.log(`⚠️  ${name}: No mapping (not bookable, ok)`)
        }
      }
    }
  }

  // 3. Check all service instances have IntakeQ service mappings
  console.log('\n\n🔧 CHECKING SERVICE INSTANCE INTAKEQ MAPPINGS...\n')

  const { data: serviceInstances, error: siError } = await supabaseAdmin
    .from('service_instances')
    .select(`
      id,
      payer_id,
      services (
        name
      )
    `)

  if (siError) {
    console.error('❌ Failed to fetch service instances:', siError)
    issues.push(`Failed to fetch service instances: ${siError.message}`)
  } else {
    // Filter for intake service instances
    const intakeInstances = (serviceInstances || []).filter(si => {
      const name = (si.services as any)?.name || ''
      return name.toLowerCase().includes('intake') || name.toLowerCase().includes('new patient')
    })

    console.log(`Found ${intakeInstances.length} intake service instances\n`)

    for (const si of intakeInstances) {
      const serviceName = (si.services as any)?.name || 'Unknown'
      const payerLabel = si.payer_id || 'ALL PAYERS (null)'

      try {
        const serviceId = await getIntakeqServiceId(si.id)
        console.log(`✅ ${serviceName} (${payerLabel}): ${serviceId}`)
      } catch (error: any) {
        console.log(`❌ ${serviceName} (${payerLabel}): NO MAPPING`)
        issues.push(`Service instance "${serviceName}" (${si.id}) has no IntakeQ service mapping`)
      }
    }
  }

  // 4. Check for any recent bookings with errors
  console.log('\n\n📅 CHECKING RECENT APPOINTMENTS (last 24 hours)...\n')

  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { data: recentAppts, error: apptsError } = await supabaseAdmin
    .from('appointments')
    .select(`
      id,
      status,
      created_at,
      pq_appointment_id,
      notes,
      patients:patient_id (
        first_name,
        last_name,
        email
      )
    `)
    .gte('created_at', oneDayAgo.toISOString())
    .order('created_at', { ascending: false })

  if (apptsError) {
    console.error('❌ Failed to fetch recent appointments:', apptsError)
  } else {
    const errorAppts = (recentAppts || []).filter(apt => apt.status === 'error')
    const missingPqId = (recentAppts || []).filter(apt => !apt.pq_appointment_id && apt.status !== 'error')

    console.log(`Total appointments (24h): ${recentAppts?.length || 0}`)
    console.log(`With errors: ${errorAppts.length}`)
    console.log(`Missing PQ ID: ${missingPqId.length}`)

    if (errorAppts.length > 0) {
      console.log('\n❌ APPOINTMENTS WITH ERROR STATUS:\n')
      errorAppts.forEach(apt => {
        const patient = apt.patients as any
        console.log(`  ID: ${apt.id}`)
        console.log(`  Patient: ${patient?.first_name} ${patient?.last_name} (${patient?.email})`)
        console.log(`  Created: ${apt.created_at}`)
        console.log(`  Notes: ${apt.notes?.substring(0, 200)}...`)
        console.log('  ---')
      })
    }
  }

  // SUMMARY
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 DIAGNOSTIC SUMMARY\n')

  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed! No configuration issues found.')
  } else {
    if (issues.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${issues.length}):\n`)
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`)
      })
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`)
      warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
}

diagnoseBookingConfig()
  .then(() => {
    console.log('\n✅ Diagnostic complete')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Diagnostic failed:', err)
    process.exit(1)
  })

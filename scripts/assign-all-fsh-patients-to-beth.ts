/**
 * Assign all FSH patients to Beth Whipey (test user)
 * Run with: npx tsx scripts/assign-all-fsh-patients-to-beth.ts
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
const TEST_EMAIL = 'testpartner@example.com'

async function assignAllFSHPatientsToBeth() {
  console.log('👥 Assigning all FSH patients to Beth Whipey...\n')

  // Get Beth's partner user ID
  const { data: beth, error: bethError } = await supabase
    .from('partner_users')
    .select('id, full_name, role')
    .eq('email', TEST_EMAIL)
    .eq('organization_id', FSH_ORG_ID)
    .single()

  if (bethError || !beth) {
    console.error('❌ Beth Whipey user not found')
    return
  }

  console.log(`Partner User: ${beth.full_name} (${beth.role})`)
  console.log(`User ID: ${beth.id}\n`)

  // Get all FSH patients (via affiliations)
  const { data: affiliations, error: affiliationsError } = await supabase
    .from('patient_organization_affiliations')
    .select(`
      patient_id,
      patients (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')

  if (affiliationsError) {
    console.error('❌ Error fetching FSH patients:', affiliationsError.message)
    return
  }

  if (!affiliations || affiliations.length === 0) {
    console.log('⚠️  No FSH patients found to assign')
    return
  }

  console.log(`Found ${affiliations.length} FSH patients\n`)

  // Get existing assignments to avoid duplicates
  const { data: existingAssignments } = await supabase
    .from('partner_user_patient_assignments')
    .select('patient_id')
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')

  const existingPatientIds = new Set(existingAssignments?.map(a => a.patient_id) || [])

  let assigned = 0
  let skipped = 0
  let errors = 0

  for (const affiliation of affiliations) {
    const patient = affiliation.patients as any
    const patientId = affiliation.patient_id

    if (!patient) {
      console.log(`⚠️  Skipping: Patient data missing for ${patientId}`)
      skipped++
      continue
    }

    console.log(`Processing: ${patient.first_name} ${patient.last_name}`)

    // Skip if already assigned
    if (existingPatientIds.has(patientId)) {
      console.log(`  ⚠️  Already assigned, skipping`)
      skipped++
      continue
    }

    // Create assignment
    try {
      const { error: assignError } = await supabase
        .from('partner_user_patient_assignments')
        .insert({
          partner_user_id: beth.id,
          patient_id: patientId,
          organization_id: FSH_ORG_ID,
          assignment_type: 'primary',
          status: 'active',
          assigned_date: new Date().toISOString()
        })

      if (assignError) {
        console.log(`  ❌ Error: ${assignError.message}`)
        errors++
        continue
      }

      // Create activity log entry
      await supabase
        .from('patient_activity_log')
        .insert({
          patient_id: patientId,
          organization_id: FSH_ORG_ID,
          activity_type: 'case_manager_assigned',
          title: 'Case manager assigned',
          description: `Assigned to ${beth.full_name}`,
          metadata: {
            assigned_by: beth.id,
            assignment_type: 'primary',
            initial_setup: true
          },
          actor_type: 'partner_user',
          actor_id: beth.id,
          actor_name: beth.full_name,
          visible_to_partner: true,
          visible_to_patient: false
        })

      console.log(`  ✓ Assigned to Beth`)
      assigned++

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Assignment Summary')
  console.log('='.repeat(60))
  console.log(`Total FSH patients: ${affiliations.length}`)
  console.log(`✅ Newly assigned: ${assigned}`)
  console.log(`⚠️  Already assigned: ${skipped}`)
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`)
  }
  console.log('\n✅ Assignment complete!')
  console.log('\nNow log in to the dashboard and click "My Patients" to see all assigned patients.')
}

assignAllFSHPatientsToBeth()

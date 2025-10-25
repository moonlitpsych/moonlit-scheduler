/**
 * Test the partner dashboard patients API response
 * Simulates what the frontend receives
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

async function testAPILogic() {
  console.log('🧪 Testing Partner Dashboard API Logic\n')

  // Step 1: Get affiliations (like the API does)
  const { data: affiliations, error: affiliationsError } = await supabase
    .from('patient_organization_affiliations')
    .select(`
      id,
      patient_id,
      affiliation_type,
      start_date,
      consent_on_file,
      consent_expires_on,
      roi_file_url,
      primary_contact_user_id,
      status,
      patients (
        id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        status,
        primary_provider_id,
        primary_insurance_payer:payers (
          id,
          name
        )
      )
    `)
    .eq('organization_id', FSH_ORG_ID)
    .eq('status', 'active')
    .order('start_date', { ascending: false })

  if (affiliationsError) {
    console.error('❌ Error fetching affiliations:', affiliationsError)
    return
  }

  console.log(`✅ Got ${affiliations?.length || 0} affiliations\n`)

  // Step 2: Get unique patient IDs
  const patientIds = affiliations?.map((a: any) => a.patient_id) || []
  console.log(`📋 Patient IDs: ${patientIds.length}\n`)

  // Step 3: Fetch patients with provider IDs (like the API does)
  const { data: patientsWithProviderIds, error: pwpError } = await supabase
    .from('patients')
    .select('id, primary_provider_id')
    .in('id', patientIds)
    .not('primary_provider_id', 'is', null)

  console.log(`✅ Patients with primary_provider_id set: ${patientsWithProviderIds?.length || 0}`)

  if (patientsWithProviderIds && patientsWithProviderIds.length > 0) {
    console.log('Patients with provider IDs:')
    patientsWithProviderIds.forEach(p => {
      console.log(`   - ${p.id.substring(0, 8)}... → Provider ${p.primary_provider_id?.substring(0, 8)}...`)
    })
  }

  // Step 4: Get unique provider IDs
  const providerIds = [...new Set(patientsWithProviderIds?.map((p: any) => p.primary_provider_id).filter(Boolean) || [])]
  console.log(`\n📋 Provider IDs to fetch: ${providerIds.length}\n`)

  // Step 5: Fetch provider details
  const { data: providers, error: provError } = await supabase
    .from('providers')
    .select('id, first_name, last_name')
    .in('id', providerIds)

  console.log(`✅ Fetched ${providers?.length || 0} provider records`)

  if (providers && providers.length > 0) {
    console.log('Provider details:')
    providers.forEach(p => {
      console.log(`   - ${p.id.substring(0, 8)}... → Dr. ${p.first_name} ${p.last_name}`)
    })
  }

  // Step 6: Create provider lookup map (like the API does)
  const providerLookup = (providers || []).reduce((acc: any, provider: any) => {
    acc[provider.id] = provider
    return acc
  }, {})

  // Step 7: Create patient_id -> provider map
  const providersByPatient = (patientsWithProviderIds || []).reduce((acc: any, patient: any) => {
    if (patient.primary_provider_id && providerLookup[patient.primary_provider_id]) {
      acc[patient.id] = providerLookup[patient.primary_provider_id]
    }
    return acc
  }, {})

  console.log(`\n✅ Created providersByPatient map with ${Object.keys(providersByPatient).length} entries\n`)

  // Step 8: Format response (like the API does)
  console.log('📊 Final patient data (as returned by API):\n')

  affiliations?.forEach((affiliation: any) => {
    const patient = affiliation.patients
    const provider = providersByPatient[affiliation.patient_id]

    console.log(`👤 ${patient.first_name} ${patient.last_name}`)
    console.log(`   Email: ${patient.email}`)
    console.log(`   primary_provider_id in DB: ${patient.primary_provider_id || 'NULL'}`)
    console.log(`   primary_provider in response: ${provider ? `Dr. ${provider.first_name} ${provider.last_name}` : 'NULL'}`)
    console.log()
  })
}

testAPILogic()

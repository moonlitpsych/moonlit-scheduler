/**
 * Import patients and affiliate with FSH
 * Run with: npx tsx scripts/import-fsh-patients.ts <csv-file-path>
 *
 * CSV Format:
 * first_name,last_name,email,phone,date_of_birth,roi_consent,consent_expires
 * John,Doe,john@example.com,555-1234,1990-01-15,true,2026-01-15
 * Jane,Smith,jane@example.com,555-5678,1985-03-20,false,
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const FSH_ORG_ID = 'c621d896-de55-4ea7-84c2-a01502249e82'

// Normalization helpers (same as booking flow)
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
const normDob = (d?: string | null) => {
  if (!d) return null
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

interface PatientImportRow {
  first_name: string
  last_name: string
  email: string
  phone?: string
  date_of_birth?: string
  roi_consent?: string | boolean
  consent_expires?: string
  pq_client_id?: string // Optional PracticeQ ID
}

async function findOrCreatePatient(row: PatientImportRow): Promise<{ patientId: string; created: boolean }> {
  const normalizedEmail = norm(row.email)
  const normalizedFirstName = norm(row.first_name)
  const normalizedLastName = norm(row.last_name)
  const normalizedDob = normDob(row.date_of_birth)

  // STRONG MATCH: email + firstName + lastName + DOB
  if (normalizedDob) {
    const { data: strongMatch } = await supabase
      .from('patients')
      .select('id, first_name, last_name, date_of_birth')
      .eq('email', normalizedEmail)
      .ilike('first_name', normalizedFirstName)
      .ilike('last_name', normalizedLastName)
      .eq('date_of_birth', normalizedDob)
      .maybeSingle()

    if (strongMatch) {
      console.log(`  ✓ Found existing patient: ${row.first_name} ${row.last_name} (${strongMatch.id})`)
      return { patientId: strongMatch.id, created: false }
    }
  }

  // NO MATCH: Create new patient
  const { data: newPatient, error: createError } = await supabase
    .from('patients')
    .insert({
      first_name: row.first_name,
      last_name: row.last_name,
      email: normalizedEmail,
      phone: row.phone || null,
      date_of_birth: normalizedDob,
      status: 'active',
      pq_client_id: row.pq_client_id || null
    })
    .select('id')
    .single()

  if (createError || !newPatient) {
    throw new Error(`Failed to create patient: ${createError?.message}`)
  }

  console.log(`  ✓ Created new patient: ${row.first_name} ${row.last_name} (${newPatient.id})`)
  return { patientId: newPatient.id, created: true }
}

async function createAffiliation(patientId: string, row: PatientImportRow) {
  // Check if affiliation already exists
  const { data: existing } = await supabase
    .from('patient_organization_affiliations')
    .select('id, status')
    .eq('patient_id', patientId)
    .eq('organization_id', FSH_ORG_ID)
    .maybeSingle()

  if (existing) {
    console.log(`  ⚠️  Affiliation already exists (${existing.status})`)
    return
  }

  // Parse ROI consent
  const roiConsent = row.roi_consent === true || row.roi_consent === 'true' || row.roi_consent === '1' || row.roi_consent === 'yes'
  const consentExpires = row.consent_expires ? normDob(row.consent_expires) : null

  // Create affiliation
  const { error: affiliationError } = await supabase
    .from('patient_organization_affiliations')
    .insert({
      patient_id: patientId,
      organization_id: FSH_ORG_ID,
      affiliation_type: 'partner_referral', // FSH is a partner referral
      start_date: new Date().toISOString(),
      consent_on_file: roiConsent,
      consent_expires_on: consentExpires,
      status: 'active'
    })

  if (affiliationError) {
    throw new Error(`Failed to create affiliation: ${affiliationError.message}`)
  }

  console.log(`  ✓ Created FSH affiliation (ROI: ${roiConsent ? 'Yes' : 'No'})`)
}

async function importPatients(csvPath: string) {
  console.log('📥 Importing FSH patients from CSV...\n')

  // Read and parse CSV
  let fileContent: string
  try {
    fileContent = readFileSync(csvPath, 'utf-8')
  } catch (err: any) {
    console.error(`❌ Error reading file: ${err.message}`)
    process.exit(1)
  }

  const records: PatientImportRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })

  if (records.length === 0) {
    console.error('❌ No records found in CSV')
    process.exit(1)
  }

  console.log(`Found ${records.length} patients to import\n`)

  let created = 0
  let updated = 0
  let errors = 0

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    console.log(`\n[${i + 1}/${records.length}] Processing: ${row.first_name} ${row.last_name}`)

    try {
      // Validate required fields
      if (!row.first_name || !row.last_name || !row.email) {
        console.error('  ❌ Missing required fields (first_name, last_name, email)')
        errors++
        continue
      }

      // Find or create patient
      const { patientId, created: isNew } = await findOrCreatePatient(row)

      if (isNew) {
        created++
      } else {
        updated++
      }

      // Create affiliation
      await createAffiliation(patientId, row)

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary')
  console.log('='.repeat(60))
  console.log(`Total processed: ${records.length}`)
  console.log(`✅ Created: ${created}`)
  console.log(`✓ Updated: ${updated}`)
  if (errors > 0) {
    console.log(`❌ Errors: ${errors}`)
  }
  console.log('\n✅ Import complete!')
}

// Check for CSV file argument
const csvPath = process.argv[2]

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-fsh-patients.ts <csv-file-path>')
  console.error('\nCSV Format:')
  console.error('first_name,last_name,email,phone,date_of_birth,roi_consent,consent_expires')
  console.error('John,Doe,john@example.com,555-1234,1990-01-15,true,2026-01-15')
  console.error('Jane,Smith,jane@example.com,555-5678,1985-03-20,false,')
  process.exit(1)
}

importPatients(csvPath)

import { supabaseAdmin } from '../src/lib/supabase'

/**
 * This script identifies all possible failure points in the booking flow
 * that could cause an error BEFORE the database record is created
 */

async function analyzeFailurePoints() {
  console.log('🔍 ANALYZING BOOKING FAILURE POINTS\n')
  console.log('='.repeat(80))

  console.log('\nThe booking flow has these steps BEFORE database insert:\n')

  console.log('1️⃣ IDEMPOTENCY CHECK')
  console.log('   - Checks if this exact booking was already submitted')
  console.log('   - Failure: Would return cached response, not error\n')

  console.log('2️⃣ PATIENT RESOLUTION')
  console.log('   - Creates or finds patient record')
  console.log('   - Possible failures:')
  console.log('     • Patient data validation failed')
  console.log('     • Database error creating patient')
  console.log('     • Strong matching query failed\n')

  console.log('3️⃣ SERVICE INSTANCE RESOLUTION')
  console.log('   - Finds which IntakeQ service to use for this payer')
  console.log('   - Possible failures:')
  console.log('     • No service instance mapped for payer')
  console.log('     • Invalid payer ID format')
  console.log('     • Database lookup error\n')

  console.log('4️⃣ CONFLICT DETECTION')
  console.log('   - Checks if provider already has appointment at this time')
  console.log('   - Possible failures:')
  console.log('     • Database query error')
  console.log('     • Time slot taken (returns 409)\n')

  console.log('5️⃣ PAYER LOOKUP')
  console.log('   - Gets payer name and details')
  console.log('   - Possible failures:')
  console.log('     • Payer not found (returns 404)\n')

  console.log('6️⃣ DATABASE INSERT')
  console.log('   - Creates appointment record')
  console.log('   - After this point, we have a database record\n')

  console.log('='.repeat(80))
  console.log('\n🎯 CHECKING FRIDAY (OCT 18) FOR CLUES...\n')

  // Check for any errors in the appointments table from Friday
  const { data: fridayAttempts, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .gte('created_at', '2025-10-18T00:00:00Z')
    .lt('created_at', '2025-10-19T00:00:00Z')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error querying Friday appointments:', error)
  } else {
    console.log(`Found ${fridayAttempts?.length || 0} appointments created on Friday, Oct 18`)

    if (fridayAttempts && fridayAttempts.length > 0) {
      // Check for any with error status or missing pq_appointment_id
      const problematic = fridayAttempts.filter(apt =>
        apt.status === 'error' || !apt.pq_appointment_id
      )

      if (problematic.length > 0) {
        console.log(`\n⚠️ Found ${problematic.length} problematic appointments on Friday:\n`)
        problematic.forEach(apt => {
          console.log(`ID: ${apt.id}`)
          console.log(`Status: ${apt.status}`)
          console.log(`PQ ID: ${apt.pq_appointment_id || 'MISSING'}`)
          console.log(`Created: ${apt.created_at}`)
          console.log(`Notes: ${apt.notes?.substring(0, 100)}...`)
          console.log('---\n')
        })
      }
    }
  }

  // Check what provider/payer Charles was trying to book
  console.log('\n🔍 CHECKING CHARLES HAYNES PATIENT RECORDS...\n')

  const { data: charlesPatients } = await supabaseAdmin
    .from('patients')
    .select('*')
    .eq('email', 'cthaynes28@gmail.com')

  if (charlesPatients && charlesPatients.length > 0) {
    console.log(`Found ${charlesPatients.length} patient records:\n`)
    charlesPatients.forEach((p, i) => {
      console.log(`${i + 1}. ID: ${p.id}`)
      console.log(`   Created: ${p.created_at}`)
      console.log(`   Name: ${p.first_name} ${p.last_name}`)
      console.log(`   Phone: ${p.phone}`)
      console.log(`   DOB: ${p.date_of_birth}\n`)
    })

    // The duplicate on Oct 20 suggests another failed booking attempt
    const oct20Patient = charlesPatients.find(p =>
      p.created_at.startsWith('2025-10-20')
    )

    if (oct20Patient) {
      console.log('⚠️ A duplicate patient record was created on Oct 20 (Sunday)')
      console.log('   This might indicate another failed booking attempt\n')

      // Check if any appointments were created with this patient ID
      const { data: oct20Appointments } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('patient_id', oct20Patient.id)

      if (!oct20Appointments || oct20Appointments.length === 0) {
        console.log('   ⚠️ NO APPOINTMENTS were created with this patient record')
        console.log('   This suggests the error occurred AFTER patient creation')
        console.log('   but BEFORE appointment creation\n')
        console.log('   Possible failure points:')
        console.log('   • Service instance resolution failed')
        console.log('   • Conflict detection failed')
        console.log('   • Payer lookup failed')
        console.log('   • Database insert failed')
      }
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 LIKELY CAUSES OF FRIDAY ERROR:\n')
  console.log('Since no database record was created on Friday (Oct 18):')
  console.log('1. Error occurred in steps 1-5 (before database insert)')
  console.log('2. Most likely: Service instance resolution or payer lookup')
  console.log('3. Or: Network timeout/error before reaching the server\n')
  console.log('Since Oct 20 created a duplicate patient but NO appointment:')
  console.log('4. This was likely another failed attempt')
  console.log('5. Error occurred AFTER patient creation but BEFORE appointment insert')
  console.log('='.repeat(80))
}

analyzeFailurePoints()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Analysis failed:', err)
    process.exit(1)
  })

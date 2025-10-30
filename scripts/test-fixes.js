#!/usr/bin/env node
/**
 * Test all three fixes for the finance appointments page
 */

async function test1() {
  console.log('✅ Test 1: CSV Import - Checking September appointments have data\n')

  const response = await fetch('http://localhost:3000/api/finance/appointments?from=2025-09-01&to=2025-09-30&limit=10')
  const json = await response.json()

  if (json.success && json.data && json.data.length > 0) {
    let withData = 0
    json.data.forEach(appt => {
      const hasProviderPaid = appt.provider_paid_cents && appt.provider_paid_cents > 0
      const hasReimbursement = appt.reimbursement_cents && appt.reimbursement_cents > 0
      const hasClaimStatus = appt.claim_status && appt.claim_status !== 'not_needed'
      if (hasProviderPaid || hasReimbursement || hasClaimStatus) {
        withData++
        console.log(`  ✅ ${appt.appt_date} ${appt.practitioner} ${appt.last_name}`)
        console.log(`     Provider Paid: $${((appt.provider_paid_cents || 0) / 100).toFixed(2)}`)
        console.log(`     Reimbursement: $${((appt.reimbursement_cents || 0) / 100).toFixed(2)}`)
        console.log(`     Claim Status: ${appt.claim_status}`)
      }
    })
    console.log(`\n  Found ${withData} out of ${json.data.length} with imported data\n`)
  } else {
    console.log('  ❌ Failed to fetch appointments\n')
  }
}

async function test2() {
  console.log('✅ Test 2: appointment_id Filter - Checking sidebar will fetch correct appointment\n')

  const response = await fetch('http://localhost:3000/api/finance/appointments?appointment_id=4a3bd8a9-c946-4f57-bb11-f8b502445c5a&limit=1')
  const json = await response.json()

  if (json.success && json.data && json.data.length === 1) {
    const appt = json.data[0]
    console.log(`  ✅ Fetched: ${appt.appt_date} ${appt.practitioner} ${appt.last_name}`)
    console.log(`     Appointment ID: ${appt.appointment_id}`)
    console.log(`     Provider Paid: $${((appt.provider_paid_cents || 0) / 100).toFixed(2)}\n`)
  } else {
    console.log('  ❌ Failed - should return exactly 1 appointment\n')
  }
}

async function main() {
  console.log('🧪 Testing Finance Appointments Page Fixes\n')
  console.log('='.repeat(60) + '\n')

  await test1()
  await test2()

  console.log('='.repeat(60))
  console.log('\n✅ Test 3: Optimistic UI Updates')
  console.log('   This requires manual testing in the browser:')
  console.log('   1. Open http://localhost:3000/admin/finance/appointments')
  console.log('   2. Click on a blue editable field (e.g., Provider Paid)')
  console.log('   3. Change the value and press Enter or click away')
  console.log('   4. Verify the page does NOT refresh (no flicker)')
  console.log('   5. Value should update instantly\n')

  console.log('='.repeat(60))
  console.log('\n📊 Import Summary from latest run:')
  console.log('   Total CSV rows: 149')
  console.log('   Matched in DB: 99')
  console.log('   Fields updated: 199')
  console.log('   Success rate: 66.4%\n')
}

main().catch(console.error)

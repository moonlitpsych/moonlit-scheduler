/**
 * Test Script: Google Meet Link Generation
 *
 * Tests the full Google Meet link generation workflow:
 * 1. Verify service is configured
 * 2. Generate a test meeting link
 * 3. Verify link is accessible
 *
 * Run: npx tsx scripts/test-google-meet-generation.ts
 */

import { googleMeetService } from '@/lib/services/googleMeetService'

async function testGoogleMeetGeneration() {
  console.log('🧪 Testing Google Meet Link Generation\n')
  console.log('=' .repeat(60))

  // Test 1: Configuration Check
  console.log('\n📋 TEST 1: Configuration Check')
  console.log('-'.repeat(60))

  try {
    const config = await googleMeetService.checkConfiguration()

    if (config.configured) {
      console.log('✅ PASS: Google Meet service is configured')
      console.log(`   Domain: ${config.details?.domain}`)
      console.log(`   Impersonate Email: ${config.details?.impersonateEmail}`)
      console.log(`   Has Service Account: ${config.details?.hasServiceAccount}`)
    } else {
      console.error('❌ FAIL: Google Meet service is NOT configured')
      console.error(`   Error: ${config.message}`)
      console.error(`   Details: ${JSON.stringify(config.details, null, 2)}`)
      console.error('\n💡 Fix: Follow GOOGLE_MEET_SETUP_GUIDE.md to configure service')
      process.exit(1)
    }
  } catch (error: any) {
    console.error('❌ FAIL: Configuration check threw error')
    console.error(`   ${error.message}`)
    process.exit(1)
  }

  // Test 2: Generate Meeting Link
  console.log('\n📋 TEST 2: Generate Test Meeting Link')
  console.log('-'.repeat(60))

  try {
    const testAppointmentId = `test-${Date.now()}`
    const testPatientName = 'Test Patient'
    const testProviderName = 'Dr. Test Provider'
    const testAppointmentTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow

    console.log(`   Appointment ID: ${testAppointmentId}`)
    console.log(`   Patient: ${testPatientName}`)
    console.log(`   Provider: ${testProviderName}`)
    console.log(`   Time: ${testAppointmentTime.toLocaleString()}`)
    console.log('')

    const meetingUrl = await googleMeetService.generateMeetingLink(
      testAppointmentId,
      testPatientName,
      testProviderName,
      testAppointmentTime
    )

    if (meetingUrl) {
      console.log('✅ PASS: Meeting link generated successfully')
      console.log(`   Meeting URL: ${meetingUrl}`)
      console.log('')
      console.log('   🔗 Test the link:')
      console.log(`      1. Open: ${meetingUrl}`)
      console.log('      2. Try joining with your personal Google account')
      console.log('      3. Try joining as guest (no account)')
      console.log('      4. Verify you can join WITHOUT logging into hello@trymoonlit.com')
    } else {
      console.error('❌ FAIL: Meeting link generation returned null')
      console.error('   Check server logs for error details')
      console.error('   Common issues:')
      console.error('   - Google Meet REST API not enabled')
      console.error('   - Service account permissions incorrect')
      console.error('   - Domain-wide delegation not configured')
      process.exit(1)
    }
  } catch (error: any) {
    console.error('❌ FAIL: Meeting link generation threw error')
    console.error(`   ${error.message}`)

    if (error.code === 403) {
      console.error('\n💡 Fix: Permission denied')
      console.error('   1. Enable Google Meet REST API in Google Cloud Console')
      console.error('   2. Configure domain-wide delegation in Google Workspace Admin')
      console.error('   3. Grant required OAuth scopes')
    } else if (error.code === 401) {
      console.error('\n💡 Fix: Authentication failed')
      console.error('   1. Check GOOGLE_MEET_SERVICE_ACCOUNT_KEY env variable')
      console.error('   2. Verify base64 encoding is correct (no line breaks!)')
      console.error('   3. Regenerate service account key if needed')
    }

    process.exit(1)
  }

  // Test 3: Access Type Verification
  console.log('\n📋 TEST 3: Access Type Verification')
  console.log('-'.repeat(60))
  console.log('✅ MANUAL TEST REQUIRED:')
  console.log('   1. Open the meeting link above in a browser')
  console.log('   2. Try to join WITHOUT logging into hello@trymoonlit.com')
  console.log('   3. Verify you can join with:')
  console.log('      - Your personal Google account ✓')
  console.log('      - Guest mode (no account) ✓')
  console.log('   4. If you see "Only @trymoonlit.com users can join" → FAIL')
  console.log('      (This means accessType is TRUSTED instead of OPEN)')

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('✅ AUTOMATED TESTS PASSED')
  console.log('='.repeat(60))
  console.log('\n📝 Next Steps:')
  console.log('   1. Complete manual test (Test 3 above)')
  console.log('   2. If manual test passes, proceed to full testing:')
  console.log('      → See GOOGLE_MEET_TESTING_GUIDE.md')
  console.log('   3. Test booking flow with real appointment')
  console.log('   4. Test PracticeQ sync for existing appointments')
  console.log('   5. Test calendar sync to Outlook')
  console.log('')
  console.log('💰 Monthly Cost: $6 (ONE Google Workspace account)')
  console.log('')
}

testGoogleMeetGeneration()
  .then(() => {
    console.log('✅ Test script completed successfully\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error.message)
    process.exit(1)
  })

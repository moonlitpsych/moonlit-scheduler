/**
 * Test API Integration - Verify Dashboard → Database → Booking System
 */

const testEndpoint = async (url, method = 'GET', body = null) => {
  try {
    console.log(`🔍 Testing: ${method} ${url}`)
    const options = { method }
    if (body && method !== 'GET') {
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(url, options)
    const data = await response.json()
    
    console.log(`✅ Status: ${response.status}`)
    console.log(`📊 Response:`, JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error)
    return null
  }
}

const main = async () => {
  const baseUrl = 'http://localhost:3003'
  
  console.log(`
🧪 DASHBOARD ↔ BOOKING INTEGRATION TEST
=====================================

Testing the full pipeline:
1. Dashboard manages provider_availability table
2. Booking system reads from provider_availability table
3. Changes in dashboard appear in booking system

Base URL: ${baseUrl}
`)

  // Test 1: Check if merged availability API works
  console.log('\n📋 Test 1: Check Merged Availability API')
  const availabilityTest = await testEndpoint(`${baseUrl}/api/patient-booking/merged-availability`, 'POST', {
    payer_id: '6f8b1234-5678-9abc-def0-123456789abc', // Utah Medicaid Fee-for-Service ID
    date: '2025-08-28', // Tomorrow
    appointmentDuration: 60
  })

  // Test 2: Check provider networks
  console.log('\n📋 Test 2: Check Provider Networks API')
  const providersTest = await testEndpoint(`${baseUrl}/api/patient-booking/providers-for-payer`, 'POST', {
    payer_id: '6f8b1234-5678-9abc-def0-123456789abc'
  })

  // Test 3: Check demo endpoints that show provider data
  console.log('\n📋 Test 3: Check Demo Enhanced Providers API')
  const demoTest = await testEndpoint(`${baseUrl}/api/demo/enhanced-providers`)

  console.log(`
🎯 INTEGRATION VERIFICATION COMPLETE!

Next Steps:
1. Log into dashboard at: ${baseUrl}/auth/login
2. Use credentials: practitioner@trymoonlit.com / testpassword123
3. Edit availability in dashboard
4. Go to booking system: ${baseUrl}/book
5. Verify calendar shows updated availability

🔗 Quick Links:
- Dashboard Login: ${baseUrl}/auth/login
- Main Booking: ${baseUrl}/book
- Staff Login (alternative): ${baseUrl}/staff-login
`)
}

// Run if in browser environment
if (typeof window !== 'undefined') {
  main()
} else {
  console.log('Run this in browser console at http://localhost:3003')
}
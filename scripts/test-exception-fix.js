#!/usr/bin/env node

/**
 * Script to test that the exception handling fix is working
 * This simulates what the patient booking flow would see
 */

const TEST_DATE = '2025-09-13' // Saturday with exception
const CONTROL_DATE = '2025-09-20' // Saturday without exception
const PROVIDER_ID = '08fbcd34-cd5f-425c-85bd-1aeeffbe9694' // Dr. Sweeney
const PAYER_ID = 'ee9b3db9-30ad-4a60-bca2-a5ef436feeac' // Example payer ID (replace with valid one)

async function testExceptionHandling() {
    console.log('🧪 Testing exception handling fix...\n')
    
    const baseUrl = process.env.API_URL || 'http://localhost:3000'
    
    try {
        // Test 1: Check date WITH exception (should return no slots)
        console.log(`📅 Test 1: Checking ${TEST_DATE} (has exception)...`)
        const response1 = await fetch(`${baseUrl}/api/patient-booking/merged-availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payer_id: PAYER_ID,
                date: TEST_DATE,
                appointmentDuration: 60,
                provider_id: PROVIDER_ID
            })
        })
        
        const result1 = await response1.json()
        
        if (result1.success) {
            const slotsForException = result1.data.totalSlots || 0
            const debug = result1.data.debug || {}
            
            console.log(`   Provider found: ${debug.bookable_providers_found > 0 ? '✅' : '❌'}`)
            console.log(`   Base availability: ${debug.base_availability_records || 0} records`)
            console.log(`   Exceptions found: ${debug.exceptions_found || 0}`)
            console.log(`   Filtered availability: ${debug.filtered_availability_records || 0} records`)
            console.log(`   Total slots: ${slotsForException}`)
            
            if (slotsForException === 0) {
                console.log(`   ✅ PASS: No slots returned for exception date (as expected)\n`)
            } else {
                console.log(`   ❌ FAIL: ${slotsForException} slots returned, expected 0\n`)
            }
        } else {
            console.log(`   ❌ API Error: ${result1.error}\n`)
        }
        
        // Test 2: Check date WITHOUT exception (should return slots)
        console.log(`📅 Test 2: Checking ${CONTROL_DATE} (no exception)...`)
        const response2 = await fetch(`${baseUrl}/api/patient-booking/merged-availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payer_id: PAYER_ID,
                date: CONTROL_DATE,
                appointmentDuration: 60,
                provider_id: PROVIDER_ID
            })
        })
        
        const result2 = await response2.json()
        
        if (result2.success) {
            const slotsForNormal = result2.data.totalSlots || 0
            const debug = result2.data.debug || {}
            
            console.log(`   Provider found: ${debug.bookable_providers_found > 0 ? '✅' : '❌'}`)
            console.log(`   Base availability: ${debug.base_availability_records || 0} records`)
            console.log(`   Exceptions found: ${debug.exceptions_found || 0}`)
            console.log(`   Filtered availability: ${debug.filtered_availability_records || 0} records`)
            console.log(`   Total slots: ${slotsForNormal}`)
            
            if (slotsForNormal > 0) {
                console.log(`   ✅ PASS: ${slotsForNormal} slots returned for normal date (as expected)\n`)
            } else {
                console.log(`   ⚠️  WARNING: No slots returned - provider might not be in network or have Saturday availability\n`)
            }
        } else {
            console.log(`   ❌ API Error: ${result2.error}\n`)
        }
        
        console.log('🏁 Test complete!')
        console.log('\n📝 Next steps:')
        console.log('1. Verify the exception exists in the database using scripts/verify-exception.sql')
        console.log('2. Test the patient booking flow in the UI for 2025-09-13')
        console.log('3. Deploy to production once verified')
        
    } catch (error) {
        console.error('❌ Test failed with error:', error)
        process.exit(1)
    }
}

// Run the test
testExceptionHandling()
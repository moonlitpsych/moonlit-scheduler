// src/app/api/debug/test-athena/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { athenaService } from '@/lib/services/athenaService'

/**
 * Test Athena Health API connection using sandbox credentials
 * 
 * Practice ID: 80000 (from email)
 * Patient ID: 14545 (for PHR testing)
 * Test credentials: phrtest_preview@mailinator.com / Password1
 */
export async function GET(request: NextRequest) {
  console.log('🧪 === Athena API Connection Test Starting ===')
  
  try {
    // Test basic connection
    console.log('1️⃣ Testing basic API connection...')
    const connectionTest = await athenaService.testConnection()
    
    if (!connectionTest.success) {
      console.log('❌ Connection test failed:', connectionTest.error)
      return NextResponse.json({
        success: false,
        error: connectionTest.error,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    console.log('✅ Basic connection successful!')
    
    // Test providers endpoint
    console.log('2️⃣ Testing providers endpoint...')
    const providers = await athenaService.getProviders()
    
    console.log(`✅ Found ${providers.length} providers`)
    if (providers.length > 0) {
      console.log('Sample provider:', providers[0])
    }

    // Test patient search (using sandbox patient ID)
    console.log('3️⃣ Testing patient search...')
    let patientSearchResult = null
    try {
      // Search for the test patient mentioned in the email
      const response = await fetch(`${process.env.ATHENA_BASE_URL}/v1/${process.env.ATHENA_PRACTICE_ID}/patients/14545`, {
        headers: {
          'Authorization': `Bearer ${await (athenaService as any).getToken()}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        patientSearchResult = await response.json()
        console.log('✅ Test patient found!')
      } else {
        console.log(`⚠️ Test patient search returned ${response.status}`)
        patientSearchResult = { error: `HTTP ${response.status}` }
      }
    } catch (patientError) {
      console.log('⚠️ Patient search error (expected in sandbox):', patientError)
      patientSearchResult = { error: 'Patient endpoint not accessible or configured differently' }
    }

    // Return comprehensive test results
    const testResults = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.ATHENA_ENVIRONMENT || 'sandbox',
      practiceId: process.env.ATHENA_PRACTICE_ID,
      baseUrl: process.env.ATHENA_BASE_URL,
      connectionTest: connectionTest,
      providers: {
        count: providers.length,
        sample: providers.length > 0 ? providers[0] : null
      },
      patientTest: patientSearchResult,
      credentials: {
        clientIdConfigured: !!process.env.ATHENA_CLIENT_ID,
        clientSecretConfigured: !!process.env.ATHENA_CLIENT_SECRET,
        baseUrlConfigured: !!process.env.ATHENA_BASE_URL,
        practiceIdConfigured: !!process.env.ATHENA_PRACTICE_ID
      }
    }

    console.log('🎉 === Athena API Test Complete ===')
    console.log('Test Results Summary:', {
      connection: connectionTest.success ? '✅' : '❌',
      providers: providers.length > 0 ? '✅' : '❌',
      patientTest: patientSearchResult && !patientSearchResult.error ? '✅' : '⚠️'
    })

    return NextResponse.json(testResults, { status: 200 })

  } catch (error: any) {
    console.error('❌ Athena API test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.ATHENA_ENVIRONMENT || 'sandbox',
      practiceId: process.env.ATHENA_PRACTICE_ID,
      baseUrl: process.env.ATHENA_BASE_URL
    }, { status: 500 })
  }
}
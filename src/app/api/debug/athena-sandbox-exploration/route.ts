// src/app/api/debug/athena-sandbox-exploration/route.ts
import { NextRequest, NextResponse } from 'next/server'

/**
 * Explore Athena sandbox environment to understand available data and endpoints
 * Based on credentials: Practice ID 80000, Patient ID 14545
 */
export async function GET(request: NextRequest) {
  console.log('🔍 === Athena Sandbox Exploration Starting ===')
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: 'sandbox',
    exploreResults: {}
  }

  try {
    // Get token for manual API calls
    const tokenResponse = await fetch(process.env.ATHENA_TOKEN_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.ATHENA_CLIENT_ID}:${process.env.ATHENA_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
    })

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token
    console.log('✅ Token acquired for exploration')

    // Define endpoints to test with both practice IDs
    const practiceIds = ['3409601', '80000'] // Your configured ID + email mentioned ID
    const endpoints = [
      '/providers',
      '/departments', 
      '/appointmenttypes',
      '/patients',
      '/appointments'
    ]

    // Test each practice ID + endpoint combination
    for (const practiceId of practiceIds) {
      console.log(`\n🏥 Testing Practice ID: ${practiceId}`)
      results.exploreResults[practiceId] = {}
      
      for (const endpoint of endpoints) {
        const url = `${process.env.ATHENA_BASE_URL}/v1/${practiceId}${endpoint}`
        
        try {
          console.log(`  📍 Testing: ${endpoint}`)
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          const responseData = response.ok ? await response.json() : null
          
          results.exploreResults[practiceId][endpoint] = {
            status: response.status,
            statusText: response.statusText,
            success: response.ok,
            dataKeys: responseData ? Object.keys(responseData) : [],
            sampleData: responseData ? (
              endpoint === '/patients' ? 'Patient data (truncated for privacy)' :
              endpoint === '/appointments' ? 'Appointment data (truncated)' :
              responseData
            ) : null
          }

          if (response.ok) {
            console.log(`    ✅ ${response.status} - Keys: ${Object.keys(responseData || {}).join(', ')}`)
          } else {
            console.log(`    ❌ ${response.status} ${response.statusText}`)
          }

        } catch (error) {
          console.log(`    ⚠️ Error: ${error}`)
          results.exploreResults[practiceId][endpoint] = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    }

    // Specific test for the patient mentioned in your email
    console.log('\n🧑‍⚕️ Testing specific patient ID from email...')
    for (const practiceId of practiceIds) {
      const patientUrl = `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/patients/14545`
      
      try {
        const response = await fetch(patientUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        const responseData = response.ok ? await response.json() : await response.text()
        
        results.exploreResults[practiceId]['specificPatient14545'] = {
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          data: response.ok ? 'Patient found (details truncated)' : responseData
        }

        console.log(`  Practice ${practiceId} - Patient 14545: ${response.status} ${response.statusText}`)
        
      } catch (error) {
        results.exploreResults[practiceId]['specificPatient14545'] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    console.log('🎉 === Sandbox Exploration Complete ===')
    
    // Summary
    let workingPracticeId = null
    let workingEndpoints: string[] = []
    
    for (const practiceId of practiceIds) {
      const practiceResults = results.exploreResults[practiceId]
      const successfulEndpoints = Object.entries(practiceResults)
        .filter(([_, result]: [string, any]) => result.success)
        .map(([endpoint, _]) => endpoint)
      
      if (successfulEndpoints.length > 0) {
        workingPracticeId = practiceId
        workingEndpoints = successfulEndpoints
        break
      }
    }

    results.summary = {
      workingPracticeId,
      workingEndpoints,
      totalEndpointsTested: practiceIds.length * endpoints.length,
      recommendedNextSteps: workingPracticeId ? 
        [`Use practice ID ${workingPracticeId}`, `Focus on endpoints: ${workingEndpoints.join(', ')}`] :
        ['Contact Athena support', 'Verify sandbox setup', 'Check if additional configuration needed']
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('❌ Sandbox exploration failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
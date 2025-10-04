// src/app/api/debug/athena-discover-endpoints/route.ts
import { NextRequest, NextResponse } from 'next/server'

/**
 * Intelligent discovery of Athena API endpoints and required fields
 * Uses trial-and-error to understand the proper data structures
 */
export async function GET(request: NextRequest) {
  console.log('🔍 === Athena API Endpoint Discovery Starting ===')
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: 'sandbox',
    practiceId: process.env.ATHENA_PRACTICE_ID,
    discoveries: {}
  }

  try {
    // Get token
    const tokenResponse = await fetch(process.env.ATHENA_TOKEN_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.ATHENA_CLIENT_ID}:${process.env.ATHENA_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
    })

    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token
    const practiceId = process.env.ATHENA_PRACTICE_ID
    const baseUrl = process.env.ATHENA_BASE_URL

    console.log('✅ Token acquired for discovery')

    // 1. Discover Department/Practice creation
    console.log('🏢 Discovering Department/Practice creation...')
    
    // Try different endpoints for departments
    const departmentEndpoints = [
      '/departments',
      '/practices', 
      '/locations',
      '/sites',
      '/facilities'
    ]

    for (const endpoint of departmentEndpoints) {
      try {
        console.log(`  Testing POST ${endpoint}...`)
        
        // Try minimal data first
        const response = await fetch(`${baseUrl}/v1/${practiceId}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'name=Test+Department'
        })

        const responseData = await response.text()
        
        results.discoveries[endpoint] = {
          method: 'POST',
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          response: responseData
        }

        console.log(`    ${response.status} ${response.statusText}`)
        
        // If we get a 400 with missing fields, that tells us it's a valid endpoint
        if (response.status === 400 && responseData.includes('missingfields')) {
          console.log(`    ✅ Valid endpoint found: ${endpoint}`)
        }

      } catch (error) {
        results.discoveries[endpoint] = { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    // 2. Try form-encoded vs JSON for departments
    console.log('🏢 Testing different content types for /departments...')
    
    const departmentTests = [
      {
        name: 'form-encoded',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=Test+Dept&address1=123+Main+St&city=Salt+Lake+City&state=UT&zip=84101'
      },
      {
        name: 'json',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Dept',
          address1: '123 Main St', 
          city: 'Salt Lake City',
          state: 'UT',
          zip: '84101'
        })
      }
    ]

    for (const test of departmentTests) {
      try {
        console.log(`  Testing departments with ${test.name}...`)
        
        const response = await fetch(`${baseUrl}/v1/${practiceId}/departments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...test.headers
          },
          body: test.body
        })

        const responseData = await response.text()
        
        results.discoveries[`departments_${test.name}`] = {
          status: response.status,
          response: responseData
        }

        console.log(`    ${response.status} - ${responseData.substring(0, 100)}...`)

      } catch (error) {
        results.discoveries[`departments_${test.name}`] = { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }

    // 3. Discover Provider creation patterns
    console.log('👨‍⚕️ Discovering Provider creation...')
    
    const providerTests = [
      {
        name: 'minimal_form',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'firstname=Test&lastname=Provider&npi=1234567890'
      },
      {
        name: 'extended_form', 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'firstname=Test&lastname=Provider&npi=1234567890&schedulingname=Test+Provider&entitytypeid=1&providertypeid=1&billable=true&signatureonfileflag=true'
      }
    ]

    for (const test of providerTests) {
      try {
        console.log(`  Testing providers with ${test.name}...`)
        
        const response = await fetch(`${baseUrl}/v1/${practiceId}/providers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...test.headers
          },
          body: test.body
        })

        const responseData = await response.text()
        
        results.discoveries[`providers_${test.name}`] = {
          status: response.status,
          response: responseData
        }

        console.log(`    ${response.status} - ${responseData.substring(0, 100)}...`)

      } catch (error) {
        results.discoveries[`providers_${test.name}`] = { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    }

    // 4. Try to understand existing data structure by getting details
    console.log('📊 Analyzing existing data structures...')
    
    try {
      // Get any existing departments with details
      const deptResponse = await fetch(`${baseUrl}/v1/${practiceId}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (deptResponse.ok) {
        const deptData = await deptResponse.json()
        results.discoveries.existing_departments = deptData
      }
    } catch (error) {
      console.log('  Could not fetch existing departments')
    }

    console.log('🎉 === API Discovery Complete ===')
    
    // Summary analysis
    const validEndpoints: string[] = []
    const errorMessages: { [key: string]: string } = {}
    
    Object.entries(results.discoveries).forEach(([endpoint, result]: [string, any]) => {
      if (result.status === 400 && result.response?.includes('missingfields')) {
        validEndpoints.push(endpoint)
      }
      if (result.response?.includes('missingfields')) {
        errorMessages[endpoint] = result.response
      }
    })

    results.summary = {
      validEndpoints,
      errorMessages,
      recommendations: validEndpoints.length > 0 ? 
        [`Found ${validEndpoints.length} valid creation endpoints`, 'Parse missing fields to create proper requests'] :
        ['No valid creation endpoints found', 'May need different authentication or permissions']
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('❌ API discovery failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
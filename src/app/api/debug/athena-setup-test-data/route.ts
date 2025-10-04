// src/app/api/debug/athena-setup-test-data/route.ts
import { NextRequest, NextResponse } from 'next/server'

/**
 * Attempt to create basic test data in Athena sandbox
 * Since the sandbox appears to be empty, let's try to populate it with basic data
 */
export async function POST(request: NextRequest) {
  console.log('🛠️ === Athena Test Data Setup Starting ===')
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: 'sandbox',
    practiceId: process.env.ATHENA_PRACTICE_ID,
    setupResults: {}
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

    console.log('✅ Token acquired for setup')

    // 1. Try to create a test department
    console.log('🏢 Attempting to create test department...')
    try {
      const deptResponse = await fetch(`${process.env.ATHENA_BASE_URL}/v1/${practiceId}/departments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Moonlit Psychiatry - Test',
          address1: '123 Test St',
          city: 'Salt Lake City',
          state: 'UT',
          zip: '84101'
        })
      })

      const deptData = deptResponse.ok ? await deptResponse.json() : await deptResponse.text()
      results.setupResults.department = {
        status: deptResponse.status,
        success: deptResponse.ok,
        data: deptData
      }

      if (deptResponse.ok) {
        console.log('✅ Department created successfully')
      } else {
        console.log(`❌ Department creation failed: ${deptResponse.status}`)
      }
    } catch (error) {
      results.setupResults.department = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // 2. Try to create a test provider
    console.log('👨‍⚕️ Attempting to create test provider...')
    try {
      const providerResponse = await fetch(`${process.env.ATHENA_BASE_URL}/v1/${practiceId}/providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstname: 'Test',
          lastname: 'Psychiatrist',
          npi: '1234567890',
          specialty: 'Psychiatry',
          providertypeid: '1'
        })
      })

      const providerData = providerResponse.ok ? await providerResponse.json() : await providerResponse.text()
      results.setupResults.provider = {
        status: providerResponse.status,
        success: providerResponse.ok,
        data: providerData
      }

      if (providerResponse.ok) {
        console.log('✅ Provider created successfully')
      } else {
        console.log(`❌ Provider creation failed: ${providerResponse.status}`)
      }
    } catch (error) {
      results.setupResults.provider = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // 3. Try to create an appointment type
    console.log('📅 Attempting to create test appointment type...')
    try {
      const appointmentTypeResponse = await fetch(`${process.env.ATHENA_BASE_URL}/v1/${practiceId}/appointmenttypes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Initial Consultation',
          duration: 50,
          color: '#0074D9'
        })
      })

      const appointmentTypeData = appointmentTypeResponse.ok ? await appointmentTypeResponse.json() : await appointmentTypeResponse.text()
      results.setupResults.appointmentType = {
        status: appointmentTypeResponse.status,
        success: appointmentTypeResponse.ok,
        data: appointmentTypeData
      }

      if (appointmentTypeResponse.ok) {
        console.log('✅ Appointment type created successfully')
      } else {
        console.log(`❌ Appointment type creation failed: ${appointmentTypeResponse.status}`)
      }
    } catch (error) {
      results.setupResults.appointmentType = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // 4. Test patient creation
    console.log('🧑‍🤝‍🧑 Attempting to create test patient...')
    try {
      const patientResponse = await fetch(`${process.env.ATHENA_BASE_URL}/v1/${practiceId}/patients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstname: 'Test',
          lastname: 'Patient',
          dob: '1990-01-01',
          sex: 'M',
          email: 'testpatient@example.com',
          mobilephone: '8015551234'
        })
      })

      const patientData = patientResponse.ok ? await patientResponse.json() : await patientResponse.text()
      results.setupResults.patient = {
        status: patientResponse.status,
        success: patientResponse.ok,
        data: patientData
      }

      if (patientResponse.ok) {
        console.log('✅ Patient created successfully')
      } else {
        console.log(`❌ Patient creation failed: ${patientResponse.status}`)
      }
    } catch (error) {
      results.setupResults.patient = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // Summary
    const successful = Object.values(results.setupResults).filter((result: any) => result.success).length
    const total = Object.keys(results.setupResults).length
    
    results.summary = {
      successful,
      total,
      success: successful > 0,
      message: successful > 0 ? 
        `Successfully created ${successful}/${total} test records` : 
        'Unable to create test data - sandbox may be read-only or require different permissions'
    }

    console.log(`🎉 === Setup Complete: ${successful}/${total} successful ===`)

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('❌ Test data setup failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
// src/app/api/debug/athena-populate-sandbox/route.ts
import { NextRequest, NextResponse } from 'next/server'

/**
 * Populate Athena sandbox with proper test data in correct order:
 * 1. Find or create medical groups
 * 2. Create providers with proper medical group ID
 * 3. Create departments (if possible)
 * 4. Create patients linked to providers/departments
 */
export async function POST(request: NextRequest) {
  console.log('🏗️ === Athena Sandbox Population Starting ===')
  
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: 'sandbox',
    practiceId: process.env.ATHENA_PRACTICE_ID,
    populationResults: {}
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

    console.log('✅ Token acquired for population')

    // STEP 1: Discover medical groups
    console.log('🏥 Step 1: Discovering medical groups...')
    
    let medicalGroupId = null
    try {
      const medicalGroupsResponse = await fetch(`${baseUrl}/v1/${practiceId}/medicalgroups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (medicalGroupsResponse.ok) {
        const medicalGroupsData = await medicalGroupsResponse.json()
        results.populationResults.existing_medical_groups = medicalGroupsData
        
        if (medicalGroupsData.medicalgroups && medicalGroupsData.medicalgroups.length > 0) {
          medicalGroupId = medicalGroupsData.medicalgroups[0].medicalgroupid
          console.log(`✅ Found existing medical group: ${medicalGroupId}`)
        } else {
          console.log('⚠️ No existing medical groups found')
        }
      } else {
        console.log(`❌ Medical groups endpoint failed: ${medicalGroupsResponse.status}`)
      }
    } catch (error) {
      console.log('⚠️ Could not access medical groups:', error)
    }

    // Try to create a medical group if none exists
    if (!medicalGroupId) {
      console.log('🏥 Attempting to create medical group...')
      
      try {
        const createGroupResponse = await fetch(`${baseUrl}/v1/${practiceId}/medicalgroups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'name=Moonlit+Psychiatry+Test&groupnpi=1234567890'
        })
        
        const createGroupData = await createGroupResponse.text()
        results.populationResults.medical_group_creation = {
          status: createGroupResponse.status,
          response: createGroupData
        }
        
        if (createGroupResponse.ok) {
          const groupData = JSON.parse(createGroupData)
          medicalGroupId = groupData.medicalgroupid
          console.log(`✅ Created medical group: ${medicalGroupId}`)
        } else {
          console.log(`❌ Medical group creation failed: ${createGroupResponse.status} - ${createGroupData}`)
        }
      } catch (error) {
        results.populationResults.medical_group_creation = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // STEP 2: Create providers (now that we have medical group ID)
    console.log('👨‍⚕️ Step 2: Creating providers...')
    
    if (medicalGroupId) {
      console.log(`Using medical group ID: ${medicalGroupId}`)
      
      // Create a test provider with all required fields
      try {
        const providerData = [
          `firstname=Test`,
          `lastname=Psychiatrist`,
          `npi=1234567890`,
          `schedulingname=Dr.+Test+Psychiatrist`,
          `entitytypeid=1`,
          `billable=true`,
          `signatureonfileflag=true`,
          `medicalgroupid=${medicalGroupId}`,
          `providertypeid=1`
        ].join('&')

        console.log('📝 Creating provider with data:', providerData)
        
        const providerResponse = await fetch(`${baseUrl}/v1/${practiceId}/providers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: providerData
        })
        
        const providerResponseData = await providerResponse.text()
        results.populationResults.provider_creation = {
          status: providerResponse.status,
          response: providerResponseData
        }
        
        if (providerResponse.ok) {
          const provider = JSON.parse(providerResponseData)
          console.log(`✅ Provider created successfully: ${provider.providerid}`)
        } else {
          console.log(`❌ Provider creation failed: ${providerResponse.status} - ${providerResponseData}`)
        }
        
      } catch (error) {
        results.populationResults.provider_creation = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    } else {
      console.log('❌ Cannot create providers without medical group ID')
      results.populationResults.provider_creation = {
        skipped: 'No medical group ID available'
      }
    }

    // STEP 3: Try to create departments/locations
    console.log('🏢 Step 3: Exploring department creation...')
    
    const departmentEndpoints = ['departments', 'practices']
    
    for (const endpoint of departmentEndpoints) {
      try {
        const deptResponse = await fetch(`${baseUrl}/v1/${practiceId}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'name=Test+Department&address1=123+Main+St&city=Salt+Lake+City&state=UT&zip=84101'
        })
        
        const deptResponseData = await deptResponse.text()
        results.populationResults[`${endpoint}_creation`] = {
          status: deptResponse.status,
          response: deptResponseData
        }
        
        console.log(`  ${endpoint}: ${deptResponse.status} - ${deptResponseData.substring(0, 100)}...`)
        
      } catch (error) {
        results.populationResults[`${endpoint}_creation`] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // STEP 4: Check final state
    console.log('📊 Step 4: Checking final sandbox state...')
    
    try {
      // Re-fetch providers to see if we now have data
      const providersResponse = await fetch(`${baseUrl}/v1/${practiceId}/providers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (providersResponse.ok) {
        const providersData = await providersResponse.json()
        results.populationResults.final_providers_check = providersData
        console.log(`✅ Final check: ${providersData.totalcount} providers in sandbox`)
      }
    } catch (error) {
      console.log('⚠️ Could not verify final state')
    }

    console.log('🎉 === Sandbox Population Complete ===')
    
    // Summary
    const success_count = Object.values(results.populationResults).filter((result: any) => 
      result.status >= 200 && result.status < 300
    ).length
    
    results.summary = {
      total_operations: Object.keys(results.populationResults).length,
      successful_operations: success_count,
      medical_group_id: medicalGroupId,
      next_steps: medicalGroupId ? 
        ['Medical group available', 'Try creating more providers', 'Test patient creation'] :
        ['Need to resolve medical group creation', 'Contact Athena support for sandbox setup']
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    console.error('❌ Sandbox population failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
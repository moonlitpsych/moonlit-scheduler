/**
 * Debug endpoint to test IntakeQ client operations
 * GET /api/debug/test-intakeq-client?clientId=116
 * POST /api/debug/test-intakeq-client
 */

import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const clientId = searchParams.get('clientId')
        const email = searchParams.get('email')

        if (!clientId && !email) {
            return NextResponse.json({
                success: false,
                error: 'clientId or email parameter required'
            }, { status: 400 })
        }

        // Test different ways to fetch a client
        const results: any = {}

        if (clientId) {
            // Try method 1: Direct GET (this might fail with HTML)
            try {
                console.log(`🔍 Testing GET /clients/${clientId}`)
                const response1 = await intakeQService.makeRequest(`/clients/${clientId}`, {
                    method: 'GET'
                })
                results.directGet = { success: true, data: response1 }
            } catch (error: any) {
                results.directGet = { success: false, error: error.message }
            }

            // Try method 2: Search with ID parameter
            try {
                console.log(`🔍 Testing GET /clients?id=${clientId}`)
                const response2 = await intakeQService.makeRequest(`/clients?id=${clientId}`, {
                    method: 'GET'
                })
                results.searchById = { success: true, data: response2 }
            } catch (error: any) {
                results.searchById = { success: false, error: error.message }
            }

            // Try method 3: Search all and filter
            try {
                console.log(`🔍 Testing GET /clients with search`)
                const response3 = await intakeQService.makeRequest('/clients', {
                    method: 'GET'
                })
                const clients = Array.isArray(response3) ? response3 : []
                const found = clients.find((c: any) => c.Id === clientId || c.Id === parseInt(clientId))
                results.searchAndFilter = {
                    success: !!found,
                    totalClients: clients.length,
                    foundClient: found
                }
            } catch (error: any) {
                results.searchAndFilter = { success: false, error: error.message }
            }
        }

        if (email) {
            // Search by email
            try {
                console.log(`🔍 Testing GET /clients?email=${email}`)
                const response = await intakeQService.makeRequest(`/clients?email=${encodeURIComponent(email)}`, {
                    method: 'GET'
                })
                results.searchByEmail = { success: true, data: response }
            } catch (error: any) {
                results.searchByEmail = { success: false, error: error.message }
            }
        }

        return NextResponse.json({
            success: true,
            clientId,
            email,
            results
        })

    } catch (error: any) {
        console.error('❌ Error in test endpoint:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Test failed'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Test creating a client with all possible fields
        const testClient = {
            FirstName: body.firstName || 'Test',
            LastName: body.lastName || `User_${Date.now()}`,
            Email: body.email || `test_${Date.now()}@example.com`,
            Phone: body.phone || '(801) 555-1234',
            DateOfBirth: body.dateOfBirth || '1990-01-15',

            // Test all insurance field name variations
            PrimaryInsuranceCompany: body.insuranceCompany || 'Test Insurance Co',
            PrimaryInsuranceName: body.insuranceCompany || 'Test Insurance Co', // Try both
            PrimaryInsurancePolicyNumber: body.policyNumber || 'POL123456',
            PrimaryMemberID: body.policyNumber || 'POL123456', // Try both
            PrimaryInsuranceGroupNumber: body.groupNumber || 'GRP789',
            PrimaryGroupNumber: body.groupNumber || 'GRP789', // Try both
        }

        console.log('📤 Creating test client with all field variations:', JSON.stringify(testClient, null, 2))

        // Create the client
        const createResponse = await intakeQService.makeRequest('/clients', {
            method: 'POST',
            body: JSON.stringify(testClient)
        })

        console.log('📥 Create response:', JSON.stringify(createResponse, null, 2))

        // Try to fetch it back
        const clientId = createResponse.ClientId || createResponse.Id
        let fetchedClient = null

        if (clientId) {
            // Try to fetch the created client
            try {
                // First try search by email
                const searchResponse = await intakeQService.makeRequest(
                    `/clients?email=${encodeURIComponent(testClient.Email)}`,
                    { method: 'GET' }
                )

                if (Array.isArray(searchResponse)) {
                    fetchedClient = searchResponse[0]
                } else {
                    fetchedClient = searchResponse
                }
            } catch (error) {
                console.error('Could not fetch created client:', error)
            }
        }

        return NextResponse.json({
            success: true,
            sentData: testClient,
            createResponse,
            fetchedClient,
            analysis: {
                dobSent: testClient.DateOfBirth,
                dobReceived: createResponse.DateOfBirth,
                dobInFetched: fetchedClient?.DateOfBirth,
                insuranceSent: {
                    company: testClient.PrimaryInsuranceCompany,
                    policyNumber: testClient.PrimaryInsurancePolicyNumber,
                    groupNumber: testClient.PrimaryInsuranceGroupNumber
                },
                insuranceReceived: {
                    company: createResponse.PrimaryInsuranceCompany,
                    policyNumber: createResponse.PrimaryInsurancePolicyNumber,
                    groupNumber: createResponse.PrimaryInsuranceGroupNumber
                },
                insuranceInFetched: fetchedClient ? {
                    company: fetchedClient.PrimaryInsuranceCompany,
                    policyNumber: fetchedClient.PrimaryInsurancePolicyNumber,
                    groupNumber: fetchedClient.PrimaryInsuranceGroupNumber
                } : null
            }
        })

    } catch (error: any) {
        console.error('❌ Error creating test client:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Test failed'
        }, { status: 500 })
    }
}
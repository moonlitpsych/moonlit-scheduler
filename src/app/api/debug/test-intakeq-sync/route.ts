/**
 * Debug endpoint to test IntakeQ field syncing
 *
 * This endpoint tests the IntakeQ client creation/update process
 * with various date formats and insurance fields to debug why
 * some fields aren't appearing in IntakeQ profiles.
 *
 * POST /api/debug/test-intakeq-sync
 *
 * Body:
 * {
 *   "testType": "create" | "update" | "fetch",
 *   "clientId": "123" (for update/fetch),
 *   "data": {
 *     "firstName": "Test",
 *     "lastName": "User",
 *     "email": "test@example.com",
 *     "phone": "8015551234",
 *     "dateOfBirth": "1990-01-01",
 *     "payerId": "payer-id",
 *     "memberId": "ABC123",
 *     "groupNumber": "GRP456"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'
import { normalizePhone, normalizeDateOfBirth, normalizeMemberID } from '@/lib/services/intakeqEnrichment'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { testType, clientId, data } = body

        console.log('🧪 [INTAKEQ TEST] Starting test:', { testType, clientId, data })

        if (testType === 'create') {
            // Test creating a new client with various date formats
            const testDates = [
                data.dateOfBirth || '1990-01-01',  // Default reasonable date
                '1897-11-05',  // The problematic date from production
                '2000-06-15',  // A normal modern date
                '1985-12-25'   // Another normal date
            ]

            const results = []

            for (const testDate of testDates) {
                console.log(`\n🔬 Testing date: ${testDate}`)

                const normalizedDob = normalizeDateOfBirth(testDate)
                const normalizedPhone = normalizePhone(data.phone)
                const normalizedMemberId = normalizeMemberID(data.memberId)

                // Get insurance name if payerId provided
                let insuranceName = null
                if (data.payerId) {
                    const { data: mapping } = await supabaseAdmin
                        .from('payer_external_mappings')
                        .select('value')
                        .eq('payer_id', data.payerId)
                        .eq('system', 'practiceq')
                        .eq('key_name', 'insurance_company_name')
                        .single()

                    if (mapping) {
                        insuranceName = mapping.value
                    } else {
                        const { data: payer } = await supabaseAdmin
                            .from('payers')
                            .select('name')
                            .eq('id', data.payerId)
                            .single()
                        insuranceName = payer?.name
                    }
                }

                const clientData: any = {
                    FirstName: data.firstName || 'Test',
                    LastName: data.lastName || `User_${Date.now()}`,
                    Email: data.email || `test_${Date.now()}@example.com`
                }

                // Add optional fields
                if (normalizedPhone) clientData.Phone = normalizedPhone
                if (normalizedDob) clientData.DateOfBirth = normalizedDob
                if (insuranceName) clientData.PrimaryInsuranceName = insuranceName
                if (normalizedMemberId) clientData.PrimaryMemberID = normalizedMemberId
                if (data.groupNumber) clientData.PrimaryGroupNumber = data.groupNumber

                console.log('📤 Sending to IntakeQ:', JSON.stringify(clientData, null, 2))

                try {
                    // Create the client
                    const response = await intakeQService.makeRequest('/clients', {
                        method: 'POST',
                        body: JSON.stringify(clientData)
                    })

                    console.log('📥 IntakeQ Response:', JSON.stringify(response, null, 2))

                    // Immediately fetch the client to see what was actually saved
                    const fetchResponse = await intakeQService.makeRequest(`/clients/${response.ClientId}`, {
                        method: 'GET'
                    })

                    console.log('🔍 Fetched client data:', JSON.stringify(fetchResponse, null, 2))

                    results.push({
                        testDate,
                        normalizedDate: normalizedDob,
                        createResponse: response,
                        fetchedData: fetchResponse,
                        fieldsPresent: {
                            phone: !!fetchResponse.Phone,
                            dob: !!fetchResponse.DateOfBirth,
                            insurance: !!fetchResponse.PrimaryInsuranceName,
                            memberId: !!fetchResponse.PrimaryMemberID
                        }
                    })
                } catch (error: any) {
                    results.push({
                        testDate,
                        normalizedDate: normalizedDob,
                        error: error.message
                    })
                }
            }

            return NextResponse.json({
                success: true,
                testType: 'create',
                results
            })
        }

        if (testType === 'update') {
            if (!clientId) {
                return NextResponse.json({
                    success: false,
                    error: 'clientId required for update test'
                }, { status: 400 })
            }

            // Test updating an existing client
            const normalizedDob = normalizeDateOfBirth(data.dateOfBirth || '1990-01-01')
            const normalizedPhone = normalizePhone(data.phone)
            const normalizedMemberId = normalizeMemberID(data.memberId)

            const updateData: any = {}
            if (normalizedPhone) updateData.Phone = normalizedPhone
            if (normalizedDob) updateData.DateOfBirth = normalizedDob
            if (normalizedMemberId) updateData.PrimaryMemberID = normalizedMemberId

            console.log('📤 Updating client with:', JSON.stringify(updateData, null, 2))

            const updateResponse = await intakeQService.makeRequest(`/clients/${clientId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            })

            console.log('📥 Update response:', JSON.stringify(updateResponse, null, 2))

            // Fetch to verify
            const fetchResponse = await intakeQService.makeRequest(`/clients/${clientId}`, {
                method: 'GET'
            })

            return NextResponse.json({
                success: true,
                testType: 'update',
                clientId,
                updatePayload: updateData,
                updateResponse,
                fetchedData: fetchResponse,
                fieldsPresent: {
                    phone: !!fetchResponse.Phone,
                    dob: !!fetchResponse.DateOfBirth,
                    insurance: !!fetchResponse.PrimaryInsuranceName,
                    memberId: !!fetchResponse.PrimaryMemberID
                }
            })
        }

        if (testType === 'fetch') {
            if (!clientId) {
                return NextResponse.json({
                    success: false,
                    error: 'clientId required for fetch test'
                }, { status: 400 })
            }

            // Just fetch and return the client data
            const fetchResponse = await intakeQService.makeRequest(`/clients/${clientId}`, {
                method: 'GET'
            })

            return NextResponse.json({
                success: true,
                testType: 'fetch',
                clientId,
                clientData: fetchResponse,
                fieldsPresent: {
                    phone: !!fetchResponse.Phone,
                    dob: !!fetchResponse.DateOfBirth,
                    insurance: !!fetchResponse.PrimaryInsuranceName,
                    memberId: !!fetchResponse.PrimaryMemberID,
                    groupNumber: !!fetchResponse.PrimaryGroupNumber
                }
            })
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid testType. Use: create, update, or fetch'
        }, { status: 400 })

    } catch (error: any) {
        console.error('❌ Test endpoint error:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Test failed'
        }, { status: 500 })
    }
}
/**
 * Debug endpoint to test individual IntakeQ field formats
 *
 * This endpoint tests specific field formats to understand
 * what IntakeQ accepts and rejects.
 *
 * GET /api/debug/test-intakeq-fields?clientId=123
 * POST /api/debug/test-intakeq-fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const clientId = searchParams.get('clientId')

        if (!clientId) {
            return NextResponse.json({
                success: false,
                error: 'clientId parameter required'
            }, { status: 400 })
        }

        // Fetch client and analyze fields
        const client = await intakeQService.makeRequest(`/clients/${clientId}`, {
            method: 'GET'
        })

        // Analyze date format if present
        let dobAnalysis = null
        if (client.DateOfBirth) {
            const date = new Date(client.DateOfBirth)
            dobAnalysis = {
                raw: client.DateOfBirth,
                isValid: !isNaN(date.getTime()),
                year: date.getFullYear(),
                formatted: date.toISOString().slice(0, 10),
                age: new Date().getFullYear() - date.getFullYear()
            }
        }

        return NextResponse.json({
            success: true,
            clientId,
            fields: {
                FirstName: client.FirstName,
                LastName: client.LastName,
                Email: client.Email,
                Phone: client.Phone,
                DateOfBirth: client.DateOfBirth,
                PrimaryInsuranceName: client.PrimaryInsuranceName,
                PrimaryMemberID: client.PrimaryMemberID,
                PrimaryGroupNumber: client.PrimaryGroupNumber
            },
            analysis: {
                hasPhone: !!client.Phone,
                hasDob: !!client.DateOfBirth,
                hasInsurance: !!client.PrimaryInsuranceName,
                hasMemberId: !!client.PrimaryMemberID,
                hasGroupNumber: !!client.PrimaryGroupNumber,
                dobAnalysis
            }
        })
    } catch (error: any) {
        console.error('❌ Error fetching IntakeQ client:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch client'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { clientId, field, value } = body

        if (!clientId || !field) {
            return NextResponse.json({
                success: false,
                error: 'clientId and field are required'
            }, { status: 400 })
        }

        // Test updating a single field
        console.log(`🧪 Testing field update: ${field} = ${value}`)

        const updatePayload = {
            [field]: value
        }

        console.log('📤 Update payload:', JSON.stringify(updatePayload, null, 2))

        // Try the update
        let updateResponse
        let updateError = null
        try {
            updateResponse = await intakeQService.makeRequest(`/clients/${clientId}`, {
                method: 'PUT',
                body: JSON.stringify(updatePayload)
            })
            console.log('✅ Update successful')
        } catch (error: any) {
            updateError = error.message
            console.log('❌ Update failed:', error.message)
        }

        // Fetch the client to see if the field was saved
        const fetchResponse = await intakeQService.makeRequest(`/clients/${clientId}`, {
            method: 'GET'
        })

        const fieldSaved = fetchResponse[field] === value

        return NextResponse.json({
            success: !updateError,
            clientId,
            field,
            sentValue: value,
            updateError,
            updateResponse,
            fetchedValue: fetchResponse[field],
            fieldSaved,
            fullClient: fetchResponse
        })
    } catch (error: any) {
        console.error('❌ Test endpoint error:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Test failed'
        }, { status: 500 })
    }
}
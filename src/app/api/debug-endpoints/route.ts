import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const results: any = {}
    
    try {
        // Test each endpoint individually to find the JSON error
        const baseUrl = request.nextUrl.origin
        
        // Test 1: DB Connection API
        try {
            const dbResponse = await fetch(`${baseUrl}/api/test-db-connection`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
            const dbText = await dbResponse.text()
            
            results.dbConnection = {
                status: dbResponse.status,
                responseLength: dbText.length,
                isValidJSON: false,
                error: null,
                preview: dbText.slice(0, 200)
            }
            
            try {
                JSON.parse(dbText)
                results.dbConnection.isValidJSON = true
            } catch (e) {
                results.dbConnection.error = e.message
            }
        } catch (e: any) {
            results.dbConnection = { error: e.message }
        }

        // Test 2: Merged Availability API
        try {
            const mergedResponse = await fetch(`${baseUrl}/api/patient-booking/merged-availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payerId: 'test-id',
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    appointmentDuration: 60
                })
            })
            const mergedText = await mergedResponse.text()
            
            results.mergedAvailability = {
                status: mergedResponse.status,
                responseLength: mergedText.length,
                isValidJSON: false,
                error: null,
                preview: mergedText.slice(0, 200)
            }
            
            try {
                JSON.parse(mergedText)
                results.mergedAvailability.isValidJSON = true
            } catch (e) {
                results.mergedAvailability.error = e.message
            }
        } catch (e: any) {
            results.mergedAvailability = { error: e.message }
        }

        // Test 3: Provider Availability API
        try {
            const providerResponse = await fetch(`${baseUrl}/api/patient-booking/provider-availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providerId: '35ab086b-2894-446d-9ab5-3d41613017ad',
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    appointmentDuration: 60
                })
            })
            const providerText = await providerResponse.text()
            
            results.providerAvailability = {
                status: providerResponse.status,
                responseLength: providerText.length,
                isValidJSON: false,
                error: null,
                preview: providerText.slice(0, 200)
            }
            
            try {
                JSON.parse(providerText)
                results.providerAvailability.isValidJSON = true
            } catch (e) {
                results.providerAvailability.error = e.message
            }
        } catch (e: any) {
            results.providerAvailability = { error: e.message }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results: results,
            summary: {
                dbConnectionWorking: results.dbConnection?.isValidJSON === true,
                mergedAvailabilityWorking: results.mergedAvailability?.isValidJSON === true,
                providerAvailabilityWorking: results.providerAvailability?.isValidJSON === true
            }
        })

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            results: results
        }, { status: 500 })
    }
}
// src/app/api/eligibility/check/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        // Get the request body
        const body = await request.json()
        
        console.log('🔍 Eligibility check requested:', {
            firstName: body.first,
            lastName: body.last,
            insuranceName: body.insuranceName
        })

        // Forward the request to our medicaid-eligibility-checker API
        const eligibilityResponse = await fetch('http://localhost:3000/api/medicaid/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        })

        if (!eligibilityResponse.ok) {
            throw new Error(`Eligibility API responded with status: ${eligibilityResponse.status}`)
        }

        const eligibilityData = await eligibilityResponse.json()
        
        console.log('✅ Eligibility check result:', {
            enrolled: eligibilityData.enrolled,
            program: eligibilityData.program
        })

        // Return the eligibility data
        return NextResponse.json(eligibilityData)

    } catch (error: any) {
        console.error('❌ Eligibility check failed:', error)
        
        return NextResponse.json({
            enrolled: false,
            error: 'Unable to verify eligibility at this time. Please contact our team for assistance.',
            verified: false
        }, { status: 500 })
    }
}
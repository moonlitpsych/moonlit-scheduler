// src/app/api/debug/test-booking-integration/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface TestStep {
    step: string
    status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'SKIP'
    message: string
    duration?: number
    data?: any
    error?: string
}

interface IntegrationTestResult {
    testName: string
    status: 'PASS' | 'FAIL'
    totalSteps: number
    passedSteps: number
    failedSteps: number
    duration: number
    steps: TestStep[]
}

export async function GET(request: NextRequest) {
    try {
        const baseUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : 'https://booking.trymoonlit.com'
        
        console.log('🧪 Starting booking flow integration test...')
        
        const testResult: IntegrationTestResult = {
            testName: 'Complete Booking Flow Integration Test',
            status: 'PASS',
            totalSteps: 0,
            passedSteps: 0,
            failedSteps: 0,
            duration: 0,
            steps: []
        }
        
        const startTime = Date.now()
        
        // Test steps mirroring the actual booking flow
        const steps = [
            {
                name: 'Fetch Available Payers',
                endpoint: '/api/ways-to-pay/payers',
                method: 'GET',
                validate: (data: any) => {
                    // ways-to-pay API returns grouped data by state, not a simple success/payers structure
                    if (!data.Utah && !data.Idaho) return 'No state data found'
                    const utahActive = data.Utah?.active || []
                    const idahoActive = data.Idaho?.active || []
                    if (utahActive.length === 0 && idahoActive.length === 0) return 'No active payers found'
                    return null
                }
            },
            {
                name: 'Fetch Providers for Payer',
                endpoint: '/api/patient-booking/providers-for-payer',
                method: 'POST',
                payload: {
                    payer_id: '8bd0bedb-226e-4253-bfeb-46ce835ef2a8', // DMBA
                    language: 'English'
                },
                validate: (data: any) => {
                    if (!data.success) return 'Response not successful'
                    if (!data.data?.providers) return 'No providers data'
                    if (!Array.isArray(data.data.providers)) return 'Providers not array'
                    if (data.data.providers.length === 0) return 'No providers found'
                    return null
                }
            },
            {
                name: 'Fetch Availability for Date',
                endpoint: '/api/patient-booking/merged-availability',
                method: 'POST',
                payload: {
                    payer_id: '8bd0bedb-226e-4253-bfeb-46ce835ef2a8',
                    date: '2025-09-12',
                    language: 'English'
                },
                validate: (data: any) => {
                    if (!data.success) return 'Response not successful'
                    if (!data.data?.availableSlots) return 'No available slots data'
                    if (!Array.isArray(data.data.availableSlots)) return 'Available slots not array'
                    // Check for critical fields that CalendarView expects
                    if (data.data.availableSlots.length > 0) {
                        const slot = data.data.availableSlots[0]
                        if (!slot.providerId && !slot.provider_id) return 'Slot missing provider ID field'
                        if (!slot.providerName && !slot.provider_name) return 'Slot missing provider name field'
                        if (slot.isAvailable === undefined && slot.available === undefined) return 'Slot missing availability field'
                        if (!slot.time && !slot.start_time) return 'Slot missing time field'
                    }
                    return null
                }
            },
            {
                name: 'Validate Data Format Compatibility',
                endpoint: '/api/debug/validate-api-contracts',
                method: 'GET',
                validate: (data: any) => {
                    if (!data.success) return 'Response not successful'
                    if (data.summary.failed > 0) return `${data.summary.failed} API contracts failed`
                    if (data.summary.errors > 0) return `${data.summary.errors} API endpoints have errors`
                    return null
                }
            }
        ]
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            const stepStart = Date.now()
            
            const testStep: TestStep = {
                step: step.name,
                status: 'RUNNING',
                message: 'Executing...'
            }
            testResult.steps.push(testStep)
            testResult.totalSteps++
            
            try {
                console.log(`🔄 Step ${i + 1}/${steps.length}: ${step.name}`)
                
                const response = await fetch(`${baseUrl}${step.endpoint}`, {
                    method: step.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: step.payload ? JSON.stringify(step.payload) : undefined
                })
                
                if (!response.ok) {
                    testStep.status = 'FAIL'
                    testStep.message = `HTTP ${response.status}: ${response.statusText}`
                    testStep.error = await response.text()
                    testResult.failedSteps++
                    continue
                }
                
                const data = await response.json()
                const validation = step.validate(data)
                
                if (validation) {
                    testStep.status = 'FAIL'
                    testStep.message = validation
                    testStep.data = data
                    testResult.failedSteps++
                } else {
                    testStep.status = 'PASS'
                    testStep.message = 'Validation successful'
                    testStep.data = {
                        summary: getSummaryFromData(data, step.name)
                    }
                    testResult.passedSteps++
                }
                
                testStep.duration = Date.now() - stepStart
                
            } catch (error: any) {
                testStep.status = 'FAIL'
                testStep.message = `Request failed: ${error.message}`
                testStep.error = error.stack
                testStep.duration = Date.now() - stepStart
                testResult.failedSteps++
            }
        }
        
        testResult.duration = Date.now() - startTime
        testResult.status = testResult.failedSteps === 0 ? 'PASS' : 'FAIL'
        
        console.log(`✅ Integration test complete: ${testResult.status} (${testResult.passedSteps}/${testResult.totalSteps} passed)`)
        
        return NextResponse.json({
            success: true,
            testResult,
            recommendations: generateIntegrationRecommendations(testResult),
            timestamp: new Date().toISOString()
        })
        
    } catch (error: any) {
        console.error('❌ Error running integration test:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to run integration test', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}

function getSummaryFromData(data: any, stepName: string): any {
    switch (stepName) {
        case 'Fetch Available Payers':
            const utahActive = data.Utah?.active || []
            const idahoActive = data.Idaho?.active || []
            const totalPayers = utahActive.length + idahoActive.length
            return {
                totalPayers,
                samplePayer: utahActive[0]?.name || idahoActive[0]?.name || 'N/A',
                stateBreakdown: {
                    utah: utahActive.length,
                    idaho: idahoActive.length
                }
            }
        case 'Fetch Providers for Payer':
            return {
                totalProviders: data.data?.total_providers || 0,
                sampleProvider: data.data?.providers?.[0] 
                    ? `${data.data.providers[0].first_name} ${data.data.providers[0].last_name}`
                    : 'N/A'
            }
        case 'Fetch Availability for Date':
            return {
                totalSlots: data.data?.totalSlots || 0,
                sampleSlot: data.data?.availableSlots?.[0] 
                    ? {
                        time: data.data.availableSlots[0].time,
                        provider: data.data.availableSlots[0].providerName || data.data.availableSlots[0].provider_name,
                        hasRequiredFields: {
                            provider_id: !!(data.data.availableSlots[0].providerId || data.data.availableSlots[0].provider_id),
                            provider_name: !!(data.data.availableSlots[0].providerName || data.data.availableSlots[0].provider_name),
                            available: data.data.availableSlots[0].isAvailable !== undefined || data.data.availableSlots[0].available !== undefined
                        }
                    }
                    : 'N/A'
            }
        case 'Validate Data Format Compatibility':
            return {
                passRate: data.summary?.pass_rate || 0,
                totalTests: data.summary?.total_tests || 0
            }
        default:
            return {}
    }
}

function generateIntegrationRecommendations(testResult: IntegrationTestResult): string[] {
    const recommendations: string[] = []
    
    if (testResult.status === 'PASS') {
        recommendations.push('✅ All booking flow integration tests passed')
        recommendations.push('🔄 Run this test after making changes to booking APIs')
    } else {
        recommendations.push('🚨 Fix failed integration tests before deploying to production')
        
        const failedSteps = testResult.steps.filter(s => s.status === 'FAIL')
        failedSteps.forEach(step => {
            recommendations.push(`🔧 Fix: ${step.step} - ${step.message}`)
        })
    }
    
    recommendations.push('📊 This test validates the exact data flow CalendarView expects')
    recommendations.push('🛡️ Prevents field mapping errors that cause "no availability" bugs')
    
    return recommendations
}
// src/app/api/debug/validate-api-contracts/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface TestResult {
    endpoint: string
    status: 'PASS' | 'FAIL' | 'ERROR'
    message: string
    expectedFields: string[]
    actualFields: string[]
    missingFields: string[]
    extraFields: string[]
    sampleData?: any
}

interface APIContract {
    endpoint: string
    method: 'GET' | 'POST'
    payload?: any
    expectedFields: {
        [key: string]: {
            type: string
            required: boolean
            description: string
        }
    }
    expectedResponseStructure: {
        success: boolean
        data?: any
        [key: string]: any
    }
}

// Define API contracts to validate
const API_CONTRACTS: APIContract[] = [
    {
        endpoint: '/api/patient-booking/providers-for-payer',
        method: 'POST',
        payload: {
            payer_id: '8bd0bedb-226e-4253-bfeb-46ce835ef2a8',
            language: 'English'
        },
        expectedFields: {
            'data.providers[].id': { type: 'string', required: true, description: 'Provider unique identifier' },
            'data.providers[].first_name': { type: 'string', required: true, description: 'Provider first name' },
            'data.providers[].last_name': { type: 'string', required: true, description: 'Provider last name' },
            'data.providers[].is_bookable': { type: 'boolean', required: true, description: 'Whether provider accepts bookings' },
            'data.providers[].languages_spoken': { type: 'array', required: true, description: 'Languages provider speaks' },
        },
        expectedResponseStructure: {
            success: true,
            data: {
                providers: [],
                total_providers: 0
            }
        }
    },
    {
        endpoint: '/api/patient-booking/merged-availability',
        method: 'POST',
        payload: {
            payer_id: '8bd0bedb-226e-4253-bfeb-46ce835ef2a8',
            date: '2025-09-12',
            language: 'English'
        },
        expectedFields: {
            'data.availableSlots[].date': { type: 'string', required: true, description: 'Appointment date in YYYY-MM-DD format' },
            'data.availableSlots[].time': { type: 'string', required: true, description: 'Appointment time in HH:MM format' },
            'data.availableSlots[].providerId': { type: 'string', required: true, description: 'Provider ID (must match CalendarView expectations)' },
            'data.availableSlots[].providerName': { type: 'string', required: true, description: 'Provider name (must match CalendarView expectations)' },
            'data.availableSlots[].duration': { type: 'number', required: true, description: 'Appointment duration in minutes' },
            'data.availableSlots[].isAvailable': { type: 'boolean', required: true, description: 'Availability status (must match CalendarView expectations)' },
        },
        expectedResponseStructure: {
            success: true,
            data: {
                availableSlots: [],
                totalSlots: 0
            }
        }
    }
]

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Starting API contract validation...')
        const results: TestResult[] = []
        
        const baseUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000' 
            : 'https://booking.trymoonlit.com'
        
        for (const contract of API_CONTRACTS) {
            console.log(`📡 Testing ${contract.endpoint}...`)
            
            try {
                const response = await fetch(`${baseUrl}${contract.endpoint}`, {
                    method: contract.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: contract.payload ? JSON.stringify(contract.payload) : undefined
                })
                
                if (!response.ok) {
                    results.push({
                        endpoint: contract.endpoint,
                        status: 'ERROR',
                        message: `HTTP ${response.status}: ${response.statusText}`,
                        expectedFields: Object.keys(contract.expectedFields),
                        actualFields: [],
                        missingFields: Object.keys(contract.expectedFields),
                        extraFields: []
                    })
                    continue
                }
                
                const data = await response.json()
                
                // Validate response structure
                const structureValidation = validateResponseStructure(data, contract.expectedResponseStructure)
                if (!structureValidation.valid) {
                    results.push({
                        endpoint: contract.endpoint,
                        status: 'FAIL',
                        message: `Response structure validation failed: ${structureValidation.error}`,
                        expectedFields: Object.keys(contract.expectedFields),
                        actualFields: [],
                        missingFields: Object.keys(contract.expectedFields),
                        extraFields: [],
                        sampleData: data
                    })
                    continue
                }
                
                // Validate field contracts
                const fieldValidation = validateFieldContracts(data, contract.expectedFields)
                
                results.push({
                    endpoint: contract.endpoint,
                    status: fieldValidation.missingFields.length > 0 ? 'FAIL' : 'PASS',
                    message: fieldValidation.missingFields.length > 0 
                        ? `Missing required fields: ${fieldValidation.missingFields.join(', ')}`
                        : 'All required fields present and correctly typed',
                    expectedFields: Object.keys(contract.expectedFields),
                    actualFields: fieldValidation.actualFields,
                    missingFields: fieldValidation.missingFields,
                    extraFields: fieldValidation.extraFields,
                    sampleData: fieldValidation.sampleItem
                })
                
            } catch (error: any) {
                results.push({
                    endpoint: contract.endpoint,
                    status: 'ERROR',
                    message: `Request failed: ${error.message}`,
                    expectedFields: Object.keys(contract.expectedFields),
                    actualFields: [],
                    missingFields: Object.keys(contract.expectedFields),
                    extraFields: []
                })
            }
        }
        
        // Generate summary
        const summary = {
            total_tests: results.length,
            passed: results.filter(r => r.status === 'PASS').length,
            failed: results.filter(r => r.status === 'FAIL').length,
            errors: results.filter(r => r.status === 'ERROR').length,
            pass_rate: Math.round((results.filter(r => r.status === 'PASS').length / results.length) * 100)
        }
        
        console.log('✅ API contract validation complete:', summary)
        
        return NextResponse.json({
            success: true,
            summary,
            results,
            recommendations: generateRecommendations(results),
            timestamp: new Date().toISOString()
        })
        
    } catch (error: any) {
        console.error('❌ Error validating API contracts:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to validate API contracts', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}

function validateResponseStructure(data: any, expected: any): { valid: boolean, error?: string } {
    // Basic structure validation
    if (!data.hasOwnProperty('success')) {
        return { valid: false, error: 'Missing "success" field' }
    }
    
    if (typeof data.success !== 'boolean') {
        return { valid: false, error: '"success" field must be boolean' }
    }
    
    if (data.success && expected.data && !data.hasOwnProperty('data')) {
        return { valid: false, error: 'Missing "data" field for successful response' }
    }
    
    return { valid: true }
}

function validateFieldContracts(data: any, expectedFields: { [key: string]: any }): {
    actualFields: string[]
    missingFields: string[]
    extraFields: string[]
    sampleItem?: any
} {
    const actualFields: string[] = []
    const missingFields: string[] = []
    let sampleItem: any = null
    
    for (const [fieldPath, fieldConfig] of Object.entries(expectedFields)) {
        const pathParts = fieldPath.split('.')
        let current = data
        let exists = true
        
        // Navigate the object path
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i]
            
            if (part.includes('[]')) {
                // Handle array notation like "data.providers[]" or "data.providers[].id"
                const arrayKey = part.replace('[]', '')
                if (!current[arrayKey] || !Array.isArray(current[arrayKey])) {
                    exists = false
                    break
                }
                
                if (current[arrayKey].length === 0) {
                    exists = false
                    break
                }
                
                // Use first item for validation
                current = current[arrayKey][0]
                sampleItem = current
                
            } else if (i === pathParts.length - 1) {
                // Last part - check if field exists
                if (!current.hasOwnProperty(part)) {
                    exists = false
                    break
                }
                actualFields.push(fieldPath)
            } else {
                // Navigate deeper
                if (!current[part]) {
                    exists = false
                    break
                }
                current = current[part]
            }
        }
        
        if (!exists && fieldConfig.required) {
            missingFields.push(fieldPath)
        }
    }
    
    return {
        actualFields,
        missingFields,
        extraFields: [], // Could implement deep field discovery here
        sampleItem
    }
}

function generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = []
    
    const failedResults = results.filter(r => r.status === 'FAIL')
    if (failedResults.length > 0) {
        recommendations.push('🔧 Fix missing required fields to prevent CalendarView data mapping errors')
        
        const commonMissingFields = findCommonMissingFields(failedResults)
        if (commonMissingFields.length > 0) {
            recommendations.push(`🎯 Priority fields to fix: ${commonMissingFields.join(', ')}`)
        }
    }
    
    const errorResults = results.filter(r => r.status === 'ERROR')
    if (errorResults.length > 0) {
        recommendations.push('🚨 Fix API endpoint errors before validating field contracts')
    }
    
    if (results.every(r => r.status === 'PASS')) {
        recommendations.push('✅ All API contracts valid - CalendarView data mapping should work correctly')
    }
    
    recommendations.push('🔄 Run this validation after any API changes to prevent field mapping bugs')
    
    return recommendations
}

function findCommonMissingFields(failedResults: TestResult[]): string[] {
    const fieldCounts: { [key: string]: number } = {}
    
    failedResults.forEach(result => {
        result.missingFields.forEach(field => {
            fieldCounts[field] = (fieldCounts[field] || 0) + 1
        })
    })
    
    return Object.entries(fieldCounts)
        .filter(([, count]) => count > 1)
        .map(([field]) => field)
        .slice(0, 3) // Top 3 most common
}
/**
 * Debug endpoint: Test IntakeQ API connection
 *
 * Tests if the INTAKEQ_API_KEY is properly set and working
 *
 * GET /api/debug/test-intakeq
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: []
  }

  // Check 1: Is API key set?
  const rawKey = process.env.INTAKEQ_API_KEY || ''

  if (!rawKey) {
    results.checks.push({
      check: 'API Key Environment Variable',
      status: 'FAILED',
      message: 'INTAKEQ_API_KEY is not set in environment variables'
    })

    return NextResponse.json({
      success: false,
      error: 'IntakeQ API key not configured',
      details: results
    }, { status: 500 })
  }

  results.checks.push({
    check: 'API Key Environment Variable',
    status: 'PASSED',
    keyLength: rawKey.length,
    keyPreview: `${rawKey.substring(0, 8)}...${rawKey.substring(rawKey.length - 4)}`
  })

  // Check 2: Extract key (handle Next.js .env bug)
  let apiKey = rawKey
  if (rawKey.startsWith('4d09ac93') && rawKey.length > 40) {
    apiKey = rawKey.substring(0, 40)
    results.checks.push({
      check: 'Next.js .env Bug Workaround',
      status: 'APPLIED',
      message: 'Detected concatenated key, extracted first 40 chars',
      extractedKeyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    })
  } else {
    results.checks.push({
      check: 'Next.js .env Bug Workaround',
      status: 'NOT_NEEDED',
      message: 'Key appears to be correctly formatted'
    })
  }

  // Check 3: Test API connection
  try {
    const response = await fetch('https://intakeq.com/api/v1/clients?pageSize=1', {
      headers: {
        'X-Auth-Key': apiKey
      }
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    if (response.status === 200) {
      results.checks.push({
        check: 'IntakeQ API Connection',
        status: 'PASSED',
        httpStatus: response.status,
        message: 'Successfully connected to IntakeQ API',
        clientCount: Array.isArray(responseData) ? responseData.length : 'N/A'
      })

      return NextResponse.json({
        success: true,
        message: '✅ IntakeQ API is working correctly',
        details: results
      })

    } else if (response.status === 401) {
      results.checks.push({
        check: 'IntakeQ API Connection',
        status: 'FAILED',
        httpStatus: response.status,
        message: 'API key is invalid or expired (401 Unauthorized)',
        possibleCauses: [
          'API key was rotated and not updated in Vercel',
          'API key is missing from production environment',
          'API key is malformed'
        ]
      })

      return NextResponse.json({
        success: false,
        error: '❌ IntakeQ API key is invalid (401 Unauthorized)',
        details: results
      }, { status: 401 })

    } else {
      results.checks.push({
        check: 'IntakeQ API Connection',
        status: 'FAILED',
        httpStatus: response.status,
        message: `Unexpected HTTP status: ${response.status}`,
        response: responseText.substring(0, 200)
      })

      return NextResponse.json({
        success: false,
        error: `Unexpected response from IntakeQ: ${response.status}`,
        details: results
      }, { status: 500 })
    }

  } catch (error: any) {
    results.checks.push({
      check: 'IntakeQ API Connection',
      status: 'ERROR',
      message: 'Network error or exception',
      error: error.message
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to connect to IntakeQ API',
      details: results
    }, { status: 500 })
  }
}

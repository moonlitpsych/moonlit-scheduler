/**
 * DEBUG: Search for client in IntakeQ
 * GET /api/debug/search-intakeq-client?email=patient@example.com
 */

import { NextRequest, NextResponse } from 'next/server'
import { intakeQService } from '@/lib/services/intakeQService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const firstName = searchParams.get('firstName')
    const lastName = searchParams.get('lastName')

    if (!email && !firstName) {
      return NextResponse.json({
        error: 'Provide email, firstName, or lastName parameter'
      }, { status: 400 })
    }

    // IntakeQ doesn't have a direct search API, but we can try to get client by email
    // This is a workaround - we'll need to list clients and filter

    try {
      // Try searching by constructing different email patterns
      const searchEmails = email ? [email] : []

      // Try common email variations
      if (firstName && lastName) {
        const cleanFirst = firstName.toLowerCase().replace(/\s+/g, '')
        const cleanLast = lastName.toLowerCase().replace(/\s+/g, '')
        searchEmails.push(
          `${cleanFirst}.${cleanLast}@firststephouse.org`,
          `${cleanFirst}${cleanLast}@firststephouse.org`,
          `${cleanFirst}@firststephouse.org`
        )
      }

      const results = []

      for (const testEmail of searchEmails) {
        try {
          // Note: IntakeQ API doesn't have a search endpoint
          // We would need to use their client listing API with filters
          // For now, return what we tried
          results.push({
            email: testEmail,
            status: 'UNABLE_TO_SEARCH',
            note: 'IntakeQ API does not support client search by email. Need to use client listing with pagination.'
          })
        } catch (e) {
          // Continue
        }
      }

      return NextResponse.json({
        message: 'IntakeQ does not provide a search API',
        suggestion: 'Use IntakeQ dashboard to find client ID manually, then update database',
        tried_emails: searchEmails,
        results,
        next_steps: [
          '1. Log into IntakeQ dashboard',
          '2. Search for client: Michael Sweitzer',
          '3. Copy the client ID from the URL or client details',
          '4. Update database: UPDATE patients SET practiceq_client_id = \'CLIENT_ID\' WHERE id = \'b19e984e-8d03-4fe2-bf8b-02c2a802e634\''
        ]
      })

    } catch (error: any) {
      return NextResponse.json({
        error: error.message,
        rate_limit: intakeQService.getRateLimitStatus()
      }, { status: 500 })
    }

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

// CSV Export endpoint for provider data
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Apply same filters as the main GET endpoint
    const status = searchParams.get('status')
    const bookable = searchParams.get('bookable')
    const listed = searchParams.get('listed')
    const role = searchParams.get('role')

    console.log('📤 Exporting providers to CSV with filters:', { status, bookable, listed, role })

    // Build query - fetch all editable fields
    let query = supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, phone_number, title, role, provider_type, npi, is_active, is_bookable, list_on_provider_page, accepts_new_patients, telehealth_enabled, languages_spoken, about, what_i_look_for_in_a_patient, med_school_org, med_school_grad_year, residency_org, athena_provider_id, profile_image_url, created_date')
      .order('last_name', { ascending: true })

    // Apply filters
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    if (bookable === 'true') {
      query = query.eq('is_bookable', true)
    } else if (bookable === 'false') {
      query = query.eq('is_bookable', false)
    }

    if (listed === 'true') {
      query = query.eq('list_on_provider_page', true)
    } else if (listed === 'false') {
      query = query.eq('list_on_provider_page', false)
    }

    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    const { data: providers, error } = await query

    if (error) {
      console.error('❌ Error fetching providers for export:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: error },
        { status: 500 }
      )
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No providers found to export' },
        { status: 404 }
      )
    }

    console.log(`✅ Exporting ${providers.length} providers`)

    // CSV Headers
    const headers = [
      'id',
      'first_name',
      'last_name',
      'email',
      'phone_number',
      'title',
      'role',
      'provider_type',
      'npi',
      'is_active',
      'is_bookable',
      'list_on_provider_page',
      'accepts_new_patients',
      'telehealth_enabled',
      'languages_spoken',
      'about',
      'what_i_look_for_in_a_patient',
      'med_school_org',
      'med_school_grad_year',
      'residency_org',
      'athena_provider_id',
      'profile_image_url',
      'created_date'
    ]

    // Convert to CSV
    const csvRows: string[] = []

    // Add header row
    csvRows.push(headers.join(','))

    // Add data rows
    for (const provider of providers) {
      const row = headers.map(header => {
        let value = provider[header as keyof typeof provider]

        // Handle arrays (languages_spoken)
        if (Array.isArray(value)) {
          value = value.join(';') // Use semicolon to avoid CSV conflicts
        }

        // Handle null/undefined
        if (value === null || value === undefined) {
          return ''
        }

        // Convert to string and escape quotes
        let stringValue = String(value)

        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          stringValue = `"${stringValue.replace(/"/g, '""')}"`
        }

        return stringValue
      })

      csvRows.push(row.join(','))
    }

    const csvContent = csvRows.join('\n')

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="providers-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error: any) {
    console.error('❌ Error in export:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Export failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

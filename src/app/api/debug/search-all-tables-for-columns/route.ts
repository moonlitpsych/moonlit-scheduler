import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Searching all tables for intakeq-related columns...')

    // Search for any column containing 'intakeq' or 'service' or 'location' in any table
    const searches = [
      { pattern: 'intakeq%', description: 'Columns starting with "intakeq"' },
      { pattern: '%service_id%', description: 'Columns containing "service_id"' },
      { pattern: '%location_id%', description: 'Columns containing "location_id"' }
    ]

    const results: any = {}

    for (const search of searches) {
      // Try raw SQL query
      const { data, error } = await supabase
        .from('information_schema.columns' as any)
        .select('table_name, column_name, data_type')
        .ilike('column_name', search.pattern)

      results[search.description] = {
        pattern: search.pattern,
        found: data || [],
        error: error?.message || null
      }
    }

    // Also specifically check common tables
    const tablesToCheck = [
      'providers',
      'appointments',
      'service_instances',
      'services',
      'provider_services',
      'locations'
    ]

    const tableChecks: any = {}
    for (const table of tablesToCheck) {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .limit(1)
        .single()

      if (!error && data) {
        tableChecks[table] = {
          exists: true,
          columns: Object.keys(data).sort(),
          has_service_id: Object.keys(data).some(k => k.includes('service_id')),
          has_location_id: Object.keys(data).some(k => k.includes('location_id')),
          intakeq_columns: Object.keys(data).filter(k => k.includes('intakeq'))
        }
      } else {
        tableChecks[table] = {
          exists: false,
          error: error?.message
        }
      }
    }

    return NextResponse.json({
      success: true,
      column_searches: results,
      specific_table_checks: tableChecks,
      summary: {
        providers_has_intakeq_service_id: tableChecks.providers?.has_service_id &&
          tableChecks.providers?.columns.includes('intakeq_service_id'),
        providers_has_intakeq_location_id: tableChecks.providers?.has_location_id &&
          tableChecks.providers?.columns.includes('intakeq_location_id'),
        providers_intakeq_columns: tableChecks.providers?.intakeq_columns || []
      }
    })

  } catch (error: any) {
    console.error('❌ Error searching tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

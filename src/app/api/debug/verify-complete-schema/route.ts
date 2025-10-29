import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      appointments: {},
      services: {},
      finance_tables: {},
      foreign_keys: {},
      summary: {}
    }

    // Check appointments table columns
    const appointmentsCheck = await supabaseAdmin
      .from('appointments')
      .select('*')
      .limit(1)

    if (appointmentsCheck.error) {
      results.appointments = {
        exists: false,
        error: appointmentsCheck.error.message
      }
    } else {
      // Get column names from the data
      const sampleRow = appointmentsCheck.data?.[0] || {}
      const columnNames = Object.keys(sampleRow)

      results.appointments = {
        exists: true,
        columns: columnNames,
        has_id: columnNames.includes('id'),
        has_patient_id: columnNames.includes('patient_id'),
        sample_row_keys: columnNames
      }
    }

    // Check services table columns
    const servicesCheck = await supabaseAdmin
      .from('services')
      .select('*')
      .limit(1)

    if (servicesCheck.error) {
      results.services = {
        exists: false,
        error: servicesCheck.error.message
      }
    } else {
      const sampleRow = servicesCheck.data?.[0] || {}
      const columnNames = Object.keys(sampleRow)

      results.services = {
        exists: true,
        columns: columnNames,
        has_default_cpt: columnNames.includes('default_cpt'),
        sample_row_keys: columnNames
      }
    }

    // Check all finance-related tables
    const financeTableNames = [
      'patients',
      'finance_claims',
      'finance_remittances',
      'appointment_ingests',
      'fee_schedule_lines',
      'provider_pay_rules',
      'provider_earnings',
      'provider_pay_periods',
      'provider_pay_runs',
      'provider_pay_run_lines',
      'manual_overrides'
    ]

    for (const tableName of financeTableNames) {
      const tableCheck = await supabaseAdmin
        .from(tableName)
        .select('*')
        .limit(1)

      if (tableCheck.error && tableCheck.error.code === '42P01') {
        results.finance_tables[tableName] = {
          exists: false,
          error: 'Table does not exist'
        }
      } else if (tableCheck.error) {
        results.finance_tables[tableName] = {
          exists: true,
          error: tableCheck.error.message,
          error_code: tableCheck.error.code
        }
      } else {
        const sampleRow = tableCheck.data?.[0] || {}
        const columnNames = Object.keys(sampleRow)

        results.finance_tables[tableName] = {
          exists: true,
          columns: columnNames,
          row_count: tableCheck.data?.length || 0
        }
      }
    }

    // Check for foreign key relationships on finance_claims
    if (results.finance_tables['finance_claims']?.exists) {
      const claimsColumns = results.finance_tables['finance_claims'].columns || []
      results.foreign_keys.finance_claims = {
        has_appointment_id: claimsColumns.includes('appointment_id'),
        has_claim_control_number: claimsColumns.includes('claim_control_number')
      }
    }

    // Check for foreign key relationships on provider_earnings
    if (results.finance_tables['provider_earnings']?.exists) {
      const earningsColumns = results.finance_tables['provider_earnings'].columns || []
      results.foreign_keys.provider_earnings = {
        has_appointment_id: earningsColumns.includes('appointment_id'),
        has_provider_id: earningsColumns.includes('provider_id')
      }
    }

    // Generate summary
    const existingTables = Object.entries(results.finance_tables)
      .filter(([_, info]: [string, any]) => info.exists)
      .map(([name]) => name)

    const missingTables = Object.entries(results.finance_tables)
      .filter(([_, info]: [string, any]) => !info.exists)
      .map(([name]) => name)

    results.summary = {
      appointments_table_ready: results.appointments.exists && results.appointments.has_id,
      appointments_has_patient_id: results.appointments.has_patient_id,
      services_has_default_cpt: results.services.has_default_cpt,
      existing_tables_count: existingTables.length,
      missing_tables_count: missingTables.length,
      existing_tables: existingTables,
      missing_tables: missingTables,
      ready_for_migration_041: !existingTables.some(t =>
        ['appointment_ingests', 'fee_schedule_lines', 'provider_pay_rules',
         'provider_earnings', 'manual_overrides'].includes(t)
      ),
      conflicts: []
    }

    // Check for conflicts
    if (results.appointments.has_patient_id) {
      results.summary.conflicts.push('appointments.patient_id already exists - migration 041 will skip adding it')
    }
    if (results.services.has_default_cpt) {
      results.summary.conflicts.push('services.default_cpt already exists - migration 041 will skip adding it')
    }
    if (existingTables.length > 0) {
      results.summary.conflicts.push(`${existingTables.length} finance tables already exist - may cause conflicts`)
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

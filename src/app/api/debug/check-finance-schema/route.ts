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
    // Check all finance-related tables
    const expectedTables = [
      'appointment_ingests',
      'fee_schedule_lines',
      'provider_pay_rules',
      'provider_earnings',
      'provider_pay_periods',
      'provider_pay_runs',
      'provider_pay_run_lines',
      'manual_overrides',
      'patients',
      'finance_claims',
      'finance_remittances'
    ]

    // Check each expected table individually
    const tableStatus = await Promise.all(
      expectedTables.map(async (tableName) => {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)

        return {
          table: tableName,
          exists: !error || error.code !== '42P01', // 42P01 = relation does not exist
          error: error ? error.message : null,
          errorCode: error ? error.code : null
        }
      })
    )

    // Check for views
    const expectedViews = [
      'v_appointments_grid',
      'v_provider_pay_summary',
      'v_revenue_summary'
    ]

    const viewStatus = await Promise.all(
      expectedViews.map(async (viewName) => {
        const { data, error } = await supabaseAdmin
          .from(viewName)
          .select('*')
          .limit(1)

        return {
          view: viewName,
          exists: !error || error.code !== '42P01',
          error: error ? error.message : null,
          errorCode: error ? error.code : null
        }
      })
    )

    return NextResponse.json({
      success: true,
      tables: {
        expected: expectedTables,
        status: tableStatus,
        existingCount: tableStatus.filter(t => t.exists).length,
        missingCount: tableStatus.filter(t => !t.exists).length,
        missing: tableStatus.filter(t => !t.exists).map(t => t.table)
      },
      views: {
        expected: expectedViews,
        status: viewStatus,
        existingCount: viewStatus.filter(v => v.exists).length,
        missingCount: viewStatus.filter(v => !v.exists).length,
        missing: viewStatus.filter(v => !v.exists).map(v => v.view)
      },
      summary: {
        tablesReady: tableStatus.filter(t => t.exists).length === expectedTables.length,
        viewsReady: viewStatus.filter(v => v.exists).length === expectedViews.length,
        readyForUse: tableStatus.filter(t => t.exists).length === expectedTables.length &&
                     viewStatus.filter(v => v.exists).length === expectedViews.length
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

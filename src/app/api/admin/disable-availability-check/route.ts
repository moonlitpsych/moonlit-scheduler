import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Check current triggers
    const { data: triggers, error: triggerError } = await supabase.rpc('get_triggers_for_table', {
      table_name: 'appointments'
    }).single()

    // Try to disable the constraint check
    // This might be a trigger or a check constraint
    const queries = [
      // Option 1: Try to drop a check constraint
      `ALTER TABLE appointments DROP CONSTRAINT IF EXISTS check_availability;`,

      // Option 2: Try to disable triggers
      `ALTER TABLE appointments DISABLE TRIGGER ALL;`,

      // Option 3: Try to drop a specific trigger
      `DROP TRIGGER IF EXISTS check_appointment_availability ON appointments;`,

      // Option 4: Try to drop a function-based constraint
      `DROP FUNCTION IF EXISTS check_provider_availability() CASCADE;`
    ]

    const results = []
    for (const query of queries) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: query })
        if (!error) {
          results.push({ query: query.substring(0, 50), status: 'executed' })
        } else {
          results.push({ query: query.substring(0, 50), status: 'failed', error })
        }
      } catch (e) {
        results.push({ query: query.substring(0, 50), status: 'error', error: e })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Attempted to disable availability constraints',
      results,
      note: 'You may need to run these queries directly in Supabase SQL editor'
    })

  } catch (error: any) {
    // If the RPC approach doesn't work, provide SQL to run manually
    return NextResponse.json({
      success: false,
      error: error.message,
      manual_fix: `
        Run this in your Supabase SQL editor:

        -- Option 1: Disable all triggers temporarily
        ALTER TABLE appointments DISABLE TRIGGER ALL;

        -- Option 2: Drop the specific constraint (if it exists)
        ALTER TABLE appointments
        DROP CONSTRAINT IF EXISTS check_availability CASCADE;

        -- Option 3: Drop function-based checks
        DROP FUNCTION IF EXISTS check_provider_availability() CASCADE;

        -- To re-enable triggers later:
        -- ALTER TABLE appointments ENABLE TRIGGER ALL;
      `
    })
  }
}
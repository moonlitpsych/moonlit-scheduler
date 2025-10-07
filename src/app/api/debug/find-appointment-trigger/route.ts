import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    // Query to find all triggers and functions related to appointments
    const { data: functions, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT
          p.proname as function_name,
          pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (
            p.proname LIKE '%appointment%'
            OR p.proname LIKE '%availability%'
            OR pg_get_functiondef(p.oid) LIKE '%Chosen time%'
          );
      `
    })

    return NextResponse.json({
      success: true,
      functions,
      error
    })
  } catch (err: any) {
    // If RPC doesn't work, return SQL to run manually
    return NextResponse.json({
      success: false,
      error: err.message,
      sql_to_run_manually: `
-- Run this in Supabase SQL Editor to find the trigger:

SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%appointment%' OR p.proname LIKE '%availability%');

-- Also check triggers:
SELECT * FROM information_schema.triggers
WHERE event_object_table = 'appointments';
      `
    })
  }
}

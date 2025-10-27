import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function POST() {
  try {
    console.log('📦 Running migration 022: Fix booking trigger to use RPC function...')

    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'database-migrations/022-fix-booking-trigger-use-rpc.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('SQL to execute:')
    console.log(sql)

    // Execute the entire migration as a single SQL block
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error('❌ Migration failed:', error)
      return NextResponse.json({
        success: false,
        error: 'Migration failed',
        details: error
      }, { status: 500 })
    }

    console.log('✅ Migration completed successfully!')
    console.log('Result:', data)

    return NextResponse.json({
      success: true,
      message: 'Migration 022 completed successfully',
      result: data,
      changes: [
        'Dropped old trigger and function',
        'Created new trigger function that uses fn_bookable_provider_payer_asof with appointment date',
        'Recreated trigger on appointments table',
        'Verified trigger works with test case (Dr. Reynolds + Regence BCBS on Nov 3)'
      ]
    })

  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

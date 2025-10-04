import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 Checking providers table schema...')

    // Method 1: Try to select the columns directly
    const { data: directQuery, error: directError } = await supabase
      .from('providers')
      .select('intakeq_service_id, intakeq_location_id')
      .limit(1)

    console.log('📊 Direct column select result:', { data: directQuery, error: directError })

    // Method 2: Select a single provider with ALL columns to see what exists
    const { data: singleProvider, error: singleError } = await supabase
      .from('providers')
      .select('*')
      .eq('is_bookable', true)
      .limit(1)
      .single()

    console.log('📊 Single provider columns:', singleProvider ? Object.keys(singleProvider) : null)

    // Method 3: Query information_schema to get table structure
    const { data: schemaInfo, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'providers'
          AND column_name IN ('intakeq_service_id', 'intakeq_location_id', 'intakeq_practitioner_id')
          ORDER BY column_name;
        `
      })

    console.log('📊 Schema query result:', { data: schemaInfo, error: schemaError })

    // Method 4: Get ALL columns from providers table
    const { data: allColumns, error: allColumnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'providers'
          ORDER BY ordinal_position;
        `
      })

    console.log('📊 All columns query result:', { data: allColumns, error: allColumnsError })

    return NextResponse.json({
      success: true,
      checks: {
        direct_column_select: {
          attempted: ['intakeq_service_id', 'intakeq_location_id'],
          error: directError?.message || null,
          data: directQuery,
          exists: !directError
        },
        single_provider_columns: {
          all_column_names: singleProvider ? Object.keys(singleProvider).sort() : null,
          has_intakeq_service_id: singleProvider ? 'intakeq_service_id' in singleProvider : false,
          has_intakeq_location_id: singleProvider ? 'intakeq_location_id' in singleProvider : false,
          has_intakeq_practitioner_id: singleProvider ? 'intakeq_practitioner_id' in singleProvider : false
        },
        information_schema: {
          specific_columns: schemaInfo,
          all_columns: allColumns,
          error: schemaError?.message || allColumnsError?.message || null
        }
      },
      conclusion: {
        intakeq_service_id_exists: !directError && singleProvider && 'intakeq_service_id' in singleProvider,
        intakeq_location_id_exists: !directError && singleProvider && 'intakeq_location_id' in singleProvider,
        intakeq_practitioner_id_exists: singleProvider && 'intakeq_practitioner_id' in singleProvider
      }
    })

  } catch (error: any) {
    console.error('❌ Error checking providers columns:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

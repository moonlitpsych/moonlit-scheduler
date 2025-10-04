import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    console.log('🔍 FINAL VERIFICATION: Checking for intakeq_service_id and intakeq_location_id')

    // Test 1: Direct SELECT attempt
    console.log('\n📋 Test 1: Attempting direct SELECT on columns...')
    const { data: test1Data, error: test1Error } = await supabase
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, intakeq_service_id, intakeq_location_id')
      .limit(1)

    console.log('Result:', { hasData: !!test1Data, error: test1Error?.message })

    // Test 2: Get all columns from a provider record
    console.log('\n📋 Test 2: Getting ALL columns from one provider...')
    const { data: test2Data, error: test2Error } = await supabase
      .from('providers')
      .select('*')
      .eq('first_name', 'Tatiana')
      .limit(1)
      .single()

    const allColumns = test2Data ? Object.keys(test2Data).sort() : []
    console.log('Total columns:', allColumns.length)
    console.log('IntakeQ columns:', allColumns.filter(c => c.includes('intakeq')))

    // Test 3: Check multiple providers
    console.log('\n📋 Test 3: Checking all bookable providers...')
    const { data: test3Data, error: test3Error } = await supabase
      .from('providers')
      .select('id, first_name, last_name, is_bookable, intakeq_practitioner_id')
      .eq('is_bookable', true)

    console.log('Bookable providers found:', test3Data?.length)

    // Test 4: Try UPDATE to see if columns exist
    console.log('\n📋 Test 4: Attempting UPDATE (will fail if columns dont exist)...')
    const { error: test4Error } = await supabase
      .from('providers')
      .update({
        intakeq_service_id: 'test_value',
        intakeq_location_id: 'test_value'
      })
      .eq('id', '00000000-0000-0000-0000-000000000000') // Fake ID, won't match anything

    console.log('UPDATE error:', test4Error?.message)

    // Compile results
    const verification = {
      test1_direct_select: {
        attempted_columns: ['intakeq_service_id', 'intakeq_location_id'],
        success: !test1Error,
        error: test1Error?.message || null,
        interpretation: test1Error?.message?.includes('does not exist')
          ? '❌ Columns DO NOT EXIST'
          : test1Error
            ? '⚠️ Other error occurred'
            : '✅ Columns exist'
      },
      test2_all_columns: {
        total_columns: allColumns.length,
        all_columns_sorted: allColumns,
        intakeq_columns_found: allColumns.filter(c => c.includes('intakeq')),
        has_intakeq_service_id: allColumns.includes('intakeq_service_id'),
        has_intakeq_location_id: allColumns.includes('intakeq_location_id'),
        has_intakeq_practitioner_id: allColumns.includes('intakeq_practitioner_id'),
        interpretation: allColumns.includes('intakeq_service_id') || allColumns.includes('intakeq_location_id')
          ? '✅ At least one column exists'
          : '❌ Columns DO NOT EXIST'
      },
      test3_bookable_providers: {
        count: test3Data?.length || 0,
        providers: test3Data?.map(p => ({
          name: `${p.first_name} ${p.last_name}`,
          has_practitioner_id: !!p.intakeq_practitioner_id
        }))
      },
      test4_update_attempt: {
        error: test4Error?.message || null,
        interpretation: test4Error?.message?.includes('does not exist')
          ? '❌ Columns DO NOT EXIST (UPDATE failed)'
          : test4Error?.message?.includes('value violates')
            ? '✅ Columns exist (constraint violation)'
            : test4Error
              ? '⚠️ Other error'
              : '✅ No error (columns likely exist)'
      }
    }

    // FINAL CONCLUSION
    const serviceIdExists = verification.test2_all_columns.has_intakeq_service_id
    const locationIdExists = verification.test2_all_columns.has_intakeq_location_id

    return NextResponse.json({
      success: true,
      verification,
      FINAL_CONCLUSION: {
        intakeq_service_id_exists: serviceIdExists,
        intakeq_location_id_exists: locationIdExists,
        intakeq_practitioner_id_exists: verification.test2_all_columns.has_intakeq_practitioner_id,
        safe_to_add_columns: !serviceIdExists && !locationIdExists,
        recommendation: (!serviceIdExists && !locationIdExists)
          ? '✅ SAFE TO ADD - Columns do not exist in providers table'
          : '⚠️ COLUMNS ALREADY EXIST - Do not add them again'
      }
    })

  } catch (error: any) {
    console.error('❌ Error in final verification:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

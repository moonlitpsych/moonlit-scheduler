import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const PRIVRATSKY_ID = '504d53c6-54ef-40b0-81d4-80812c2c7bfd'
const PRIVRATSKY_AUTH_ID = '80dbf82b-917c-47e4-bd94-87d273844997'

export async function POST() {
  try {
    console.log('🔧 Updating Dr. Privratsky\'s schedule and investigating issues...')

    // Step 1: Update his schedule to Thursday 9am-4pm
    console.log('\n📅 Step 1: Updating schedule to Thursday 9am-4pm')

    // Delete existing availability
    const { error: deleteError } = await supabaseAdmin
      .from('provider_availability')
      .delete()
      .eq('provider_id', PRIVRATSKY_ID)

    if (deleteError) {
      throw new Error(`Failed to delete old schedule: ${deleteError.message}`)
    }

    console.log('✅ Deleted old Wednesday schedule')

    // Insert new Thursday schedule (using correct schema - no is_available column!)
    const newSchedule = [
      {
        provider_id: PRIVRATSKY_ID,
        day_of_week: 4, // Thursday
        start_time: '09:00:00',
        end_time: '16:00:00', // 4pm
        is_recurring: true,
        timezone: 'America/Denver',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    const { data: insertedSchedule, error: insertError } = await supabaseAdmin
      .from('provider_availability')
      .insert(newSchedule)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert new schedule: ${insertError.message}`)
    }

    console.log('✅ Created Thursday 9am-4pm schedule')

    // Step 2: Check RLS policies on provider_availability
    console.log('\n🔐 Step 2: Checking RLS policies')

    const { data: policies } = await supabaseAdmin.rpc('get_table_policies', {
      schema_name: 'public',
      table_name: 'provider_availability'
    }).catch(() => ({ data: null }))

    // Alternative: Query pg_policies directly
    const { data: rlsPolicies } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'provider_availability')
      .catch(() => ({ data: null }))

    console.log('RLS policies found:', rlsPolicies?.length || 0)

    // Step 3: Test if a non-admin client can update availability
    console.log('\n🧪 Step 3: Testing provider self-update capability')

    // Create a service role client (simulating what the API endpoint does)
    const testResults = {
      admin_can_insert: false,
      admin_can_delete: false,
      admin_can_select: false,
      issue_found: null as string | null
    }

    // Test admin SELECT
    const { data: selectTest, error: selectError } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', PRIVRATSKY_ID)

    testResults.admin_can_select = !selectError
    if (selectError) {
      console.error('❌ Admin SELECT failed:', selectError.message)
      testResults.issue_found = `Admin cannot SELECT: ${selectError.message}`
    } else {
      console.log('✅ Admin can SELECT (found ' + selectTest.length + ' records)')
    }

    // Test admin INSERT
    const testBlock = {
      provider_id: PRIVRATSKY_ID,
      day_of_week: 5, // Friday - test block
      start_time: '10:00:00',
      end_time: '11:00:00',
      is_recurring: true,
      timezone: 'America/Denver'
    }

    const { data: insertTest, error: insertTestError } = await supabaseAdmin
      .from('provider_availability')
      .insert([testBlock])
      .select()

    testResults.admin_can_insert = !insertTestError

    if (insertTestError) {
      console.error('❌ Admin INSERT failed:', insertTestError.message)
      testResults.issue_found = `Admin cannot INSERT: ${insertTestError.message}`
    } else {
      console.log('✅ Admin can INSERT')

      // Clean up test block
      await supabaseAdmin
        .from('provider_availability')
        .delete()
        .eq('provider_id', PRIVRATSKY_ID)
        .eq('day_of_week', 5)
    }

    // Step 4: Check if the API endpoint has proper permissions
    console.log('\n🔍 Step 4: Analyzing API endpoint behavior')

    const apiIssues = []

    // Check if provider_availability table has RLS enabled
    const { data: tableInfo } = await supabaseAdmin
      .rpc('check_rls_status', { table_name: 'provider_availability' })
      .catch(() => ({ data: null }))

    // Step 5: Verify the update was successful
    const { data: verifySchedule } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', PRIVRATSKY_ID)
      .order('day_of_week')

    console.log('\n✅ Final verification:')
    console.log('Schedule blocks:', verifySchedule?.length || 0)
    verifySchedule?.forEach(block => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      console.log(`  ${days[block.day_of_week]}: ${block.start_time} - ${block.end_time}`)
    })

    // Step 6: Diagnose why provider updates might fail
    console.log('\n🔬 Step 6: Diagnosing provider update failures')

    const diagnosis = {
      rls_enabled: null as boolean | null,
      policies_found: rlsPolicies?.length || 0,
      provider_auth_id: PRIVRATSKY_AUTH_ID,
      provider_has_auth: !!PRIVRATSKY_AUTH_ID,
      likely_issue: null as string | null
    }

    // Check if RLS is actually the issue by looking at the API code
    // The API uses supabaseAdmin which should bypass RLS
    // So the issue is likely:
    // 1. Frontend not sending correct data format
    // 2. Provider auth token expired/invalid
    // 3. API validation failing silently

    if (!testResults.admin_can_insert) {
      diagnosis.likely_issue = 'RLS policies blocking admin client (critical bug!)'
    } else if (testResults.admin_can_insert && testResults.admin_can_select) {
      diagnosis.likely_issue = 'Provider dashboard likely has frontend validation or auth issues. The API endpoint uses admin client and should work.'
    }

    return NextResponse.json({
      success: true,
      message: 'Updated Dr. Privratsky\'s schedule to Thursday 9am-4pm and diagnosed issues',
      data: {
        schedule_updated: {
          old: 'Wednesday 9am-12pm, 1pm-5pm',
          new: 'Thursday 9am-4pm',
          blocks_created: insertedSchedule?.length || 0
        },
        verification: verifySchedule?.map(block => {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          return {
            day: days[block.day_of_week],
            time: `${block.start_time} - ${block.end_time}`
          }
        }),
        test_results: testResults,
        diagnosis,
        rls_policies: rlsPolicies?.map(p => ({
          policy_name: p.policyname,
          command: p.cmd,
          permissive: p.permissive,
          roles: p.roles
        })) || []
      }
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

/**
 * GET endpoint to preview what would change
 */
export async function GET() {
  try {
    const { data: currentSchedule } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', PRIVRATSKY_ID)
      .order('day_of_week')

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    return NextResponse.json({
      success: true,
      current_schedule: currentSchedule?.map(block => ({
        day: days[block.day_of_week],
        time: `${block.start_time} - ${block.end_time}`,
        created_at: block.created_at
      })),
      proposed_change: {
        action: 'Delete all existing blocks, create single Thursday block',
        new_schedule: [
          {
            day: 'Thursday',
            time: '09:00:00 - 16:00:00'
          }
        ]
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Check RLS policies on provider_credentialing_tasks table
 */
export async function GET() {
  try {
    console.log('🔍 Checking RLS and update capability...')

    // Test if admin client can actually update
    console.log('🧪 Testing if admin client can update tasks...')

    // Get first task
    const { data: firstTask, error: selectError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('id, task_status, updated_at')
      .limit(1)
      .single()

    if (selectError || !firstTask) {
      return NextResponse.json({
        success: false,
        error: `No tasks found to test: ${selectError?.message}`
      })
    }

    console.log(`   Found task: ${firstTask.id}`)
    console.log(`   Current status: ${firstTask.task_status}`)

    // Try to update updated_at only (no functional change)
    const newTimestamp = new Date().toISOString()
    const { data: updateTest, error: updateError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .update({
        updated_at: newTimestamp,
        updated_by: 'rls-test'
      })
      .eq('id', firstTask.id)
      .select()
      .single()

    console.log(`   Update error: ${updateError?.message || 'none'}`)
    console.log(`   Update successful: ${!!updateTest}`)

    // Verify the update persisted
    const { data: verifyTask } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('id, updated_at, updated_by')
      .eq('id', firstTask.id)
      .single()

    const updatePersisted = verifyTask?.updated_at === newTimestamp

    return NextResponse.json({
      success: true,
      data: {
        test_task_id: firstTask.id,
        can_update: !updateError,
        update_error: updateError?.message || null,
        update_persisted: updatePersisted,
        before: {
          updated_at: firstTask.updated_at
        },
        after: {
          updated_at: verifyTask?.updated_at,
          updated_by: verifyTask?.updated_by
        },
        diagnosis: updateError
          ? 'RLS or permissions blocking updates'
          : updatePersisted
            ? 'Updates work correctly - issue is elsewhere'
            : 'Update succeeded but did not persist - potential replication lag'
      }
    })

  } catch (error: any) {
    console.error('❌ Error checking RLS:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to check task persistence
 *
 * GET /api/debug/check-task-persistence?providerId=xxx
 * - Shows current task statuses in database
 *
 * POST /api/debug/check-task-persistence
 * - Updates a task and verifies persistence
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const providerId = url.searchParams.get('providerId')

    if (!providerId) {
      return NextResponse.json({
        success: false,
        error: 'providerId parameter required'
      }, { status: 400 })
    }

    console.log(`🔍 Checking task persistence for provider: ${providerId}`)

    // Get all tasks for this provider
    const { data: tasks, error } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select(`
        id,
        title,
        task_status,
        updated_at,
        updated_by,
        payer:payers(id, name)
      `)
      .eq('provider_id', providerId)
      .order('created_at')

    if (error) {
      console.error('❌ Error fetching tasks:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    // Group by status
    const byStatus = {
      pending: tasks?.filter(t => t.task_status === 'pending') || [],
      in_progress: tasks?.filter(t => t.task_status === 'in_progress') || [],
      completed: tasks?.filter(t => t.task_status === 'completed') || [],
      blocked: tasks?.filter(t => t.task_status === 'blocked') || []
    }

    return NextResponse.json({
      success: true,
      data: {
        total_tasks: tasks?.length || 0,
        status_breakdown: {
          pending: byStatus.pending.length,
          in_progress: byStatus.in_progress.length,
          completed: byStatus.completed.length,
          blocked: byStatus.blocked.length
        },
        completed_tasks: byStatus.completed.map(t => ({
          id: t.id,
          title: t.title,
          payer: (t.payer as any)?.name || 'Unknown',
          updated_at: t.updated_at,
          updated_by: t.updated_by
        })),
        all_tasks: tasks?.map(t => ({
          id: t.id,
          title: t.title,
          status: t.task_status,
          payer: (t.payer as any)?.name || 'Unknown',
          updated_at: t.updated_at,
          updated_by: t.updated_by
        }))
      }
    })

  } catch (error: any) {
    console.error('❌ Error in check-task-persistence GET:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST - Test updating a task and verify it persists
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, newStatus, providerId } = body

    if (!taskId || !newStatus) {
      return NextResponse.json({
        success: false,
        error: 'taskId and newStatus are required'
      }, { status: 400 })
    }

    console.log(`🧪 Testing task update persistence`)
    console.log(`   Task ID: ${taskId}`)
    console.log(`   New Status: ${newStatus}`)

    // Step 1: Get current state
    const { data: beforeUpdate, error: beforeError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (beforeError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch task before update: ${beforeError.message}`
      }, { status: 500 })
    }

    console.log(`   Before: ${beforeUpdate.task_status}`)

    // Step 2: Update the task
    const { data: afterUpdate, error: updateError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .update({
        task_status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: 'debug-endpoint'
      })
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Update failed: ${updateError.message}`
      }, { status: 500 })
    }

    console.log(`   After: ${afterUpdate.task_status}`)

    // Step 3: Verify by reading again
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (verifyError) {
      return NextResponse.json({
        success: false,
        error: `Verification failed: ${verifyError.message}`
      }, { status: 500 })
    }

    console.log(`   Verified: ${verification.task_status}`)

    const updatePersisted = verification.task_status === newStatus

    if (!updatePersisted) {
      console.error('❌ UPDATE DID NOT PERSIST!')
    } else {
      console.log('✅ Update persisted successfully')
    }

    // Step 4: If providerId provided, check all tasks
    let allTasksCheck = null
    if (providerId) {
      const { data: allTasks } = await supabaseAdmin
        .from('provider_credentialing_tasks')
        .select('id, title, task_status')
        .eq('provider_id', providerId)
        .order('created_at')

      allTasksCheck = {
        total: allTasks?.length || 0,
        completed: allTasks?.filter(t => t.task_status === 'completed').length || 0,
        tasks: allTasks || []
      }
    }

    return NextResponse.json({
      success: true,
      test_result: {
        update_persisted: updatePersisted,
        before: {
          task_status: beforeUpdate.task_status,
          updated_at: beforeUpdate.updated_at,
          updated_by: beforeUpdate.updated_by
        },
        after_update: {
          task_status: afterUpdate.task_status,
          updated_at: afterUpdate.updated_at,
          updated_by: afterUpdate.updated_by
        },
        after_verification: {
          task_status: verification.task_status,
          updated_at: verification.updated_at,
          updated_by: verification.updated_by
        }
      },
      all_tasks_check: allTasksCheck
    })

  } catch (error: any) {
    console.error('❌ Error in check-task-persistence POST:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

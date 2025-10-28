import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

/**
 * PATCH /api/admin/credentialing-tasks/[taskId]
 *
 * Updates a specific credentialing task.
 *
 * Request body:
 * {
 *   task_status?: string
 *   notes?: string
 *   assigned_to?: string
 *   application_id?: string
 *   due_date?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { taskId } = await context.params
    const body = await request.json()

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Updating task ${taskId}...`)

    // Build update object with only provided fields
    const updates: any = {
      updated_at: new Date().toISOString(),
      updated_by: user?.email || 'admin'
    }

    if (body.task_status !== undefined) {
      updates.task_status = body.task_status
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes
    }
    if (body.assigned_to !== undefined) {
      updates.assigned_to = body.assigned_to
    }
    if (body.application_id !== undefined) {
      updates.application_id = body.application_id
    }
    if (body.due_date !== undefined) {
      updates.due_date = body.due_date
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating task:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update task' },
        { status: 500 }
      )
    }

    console.log('✅ Task updated successfully')

    return NextResponse.json({
      success: true,
      data: updatedTask
    })

  } catch (error) {
    console.error('❌ Task update API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/credentialing-tasks/[taskId]
 *
 * Retrieves a specific credentialing task.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { taskId } = await context.params

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select(`
        *,
        provider:providers(id, first_name, last_name),
        payer:payers(id, name, payer_type)
      `)
      .eq('id', taskId)
      .single()

    if (taskError) {
      console.error('❌ Error fetching task:', taskError)
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: task
    })

  } catch (error) {
    console.error('❌ Task fetch API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/credentialing-tasks/[taskId]
 *
 * Deletes a specific credentialing task.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { taskId } = await context.params

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deleting task ${taskId}...`)

    const { error: deleteError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      console.error('❌ Error deleting task:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete task' },
        { status: 500 }
      )
    }

    console.log('✅ Task deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error) {
    console.error('❌ Task delete API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Show recent task updates to diagnose persistence issues
 *
 * GET /api/debug/recent-task-updates?providerId=xxx&hours=24
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const providerId = url.searchParams.get('providerId')
    const hours = parseInt(url.searchParams.get('hours') || '24')

    if (!providerId) {
      return NextResponse.json({
        success: false,
        error: 'providerId parameter required'
      }, { status: 400 })
    }

    console.log(`🔍 Checking recent task updates for provider: ${providerId}`)

    // Calculate time threshold
    const hoursAgo = new Date()
    hoursAgo.setHours(hoursAgo.getHours() - hours)
    const threshold = hoursAgo.toISOString()

    console.log(`   Looking for updates since: ${threshold}`)

    // Get all tasks for this provider
    const { data: allTasks, error: allError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select(`
        id,
        title,
        task_status,
        updated_at,
        updated_by,
        created_at,
        payer:payers(id, name)
      `)
      .eq('provider_id', providerId)
      .order('updated_at', { ascending: false })

    if (allError) {
      return NextResponse.json({
        success: false,
        error: allError.message
      }, { status: 500 })
    }

    // Find tasks updated in the time window
    const recentlyUpdated = allTasks?.filter(t => {
      const updatedAt = new Date(t.updated_at)
      return updatedAt > hoursAgo
    }) || []

    // Find completed tasks
    const completedTasks = allTasks?.filter(t => t.task_status === 'completed') || []

    // Find tasks with updated_by set
    const tasksWithUpdater = allTasks?.filter(t => t.updated_by) || []

    // Check if any tasks were modified after creation
    const modifiedTasks = allTasks?.filter(t => {
      const created = new Date(t.created_at)
      const updated = new Date(t.updated_at)
      return updated > created
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        total_tasks: allTasks?.length || 0,
        time_window: `Last ${hours} hours`,
        threshold_timestamp: threshold,
        recently_updated: {
          count: recentlyUpdated.length,
          tasks: recentlyUpdated.map(t => ({
            id: t.id,
            title: t.title,
            status: t.task_status,
            payer: (t.payer as any)?.name,
            updated_at: t.updated_at,
            updated_by: t.updated_by
          }))
        },
        completed_tasks: {
          count: completedTasks.length,
          tasks: completedTasks.map(t => ({
            id: t.id,
            title: t.title,
            payer: (t.payer as any)?.name,
            updated_at: t.updated_at,
            updated_by: t.updated_by
          }))
        },
        tasks_with_updater: {
          count: tasksWithUpdater.length,
          tasks: tasksWithUpdater.map(t => ({
            id: t.id,
            title: t.title,
            status: t.task_status,
            payer: (t.payer as any)?.name,
            updated_by: t.updated_by,
            updated_at: t.updated_at
          }))
        },
        modified_after_creation: {
          count: modifiedTasks.length,
          tasks: modifiedTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.task_status,
            payer: (t.payer as any)?.name,
            created_at: t.created_at,
            updated_at: t.updated_at,
            time_difference_ms: new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()
          }))
        },
        diagnosis: {
          no_updates_detected: recentlyUpdated.length === 0 && modifiedTasks.length === 0,
          no_completed_tasks: completedTasks.length === 0,
          no_updater_tracked: tasksWithUpdater.length === 0,
          likely_issue:
            recentlyUpdated.length === 0 && completedTasks.length === 0
              ? 'No task updates are persisting to database - PATCH requests may not be reaching server'
              : recentlyUpdated.length > 0 && completedTasks.length === 0
                ? 'Tasks are being updated but status changes to "completed" are not persisting'
                : 'Updates appear to be working normally'
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error checking recent updates:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

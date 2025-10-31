import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ROLLER_ID = '06c5f00f-e2c1-46a7-bad1-55c406b1d190'

/**
 * POST /api/debug/fix-roller-tasks
 *
 * Deletes Dr. Roller's incorrectly generated tasks and regenerates them
 * using the correct payer-specific workflow templates
 */
export async function POST() {
  try {
    console.log('🔧 Starting fix for Dr. Roller\'s credentialing tasks...')

    // Step 1: Get all Dr. Roller's current tasks
    const { data: currentTasks } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('id, payer_id')
      .eq('provider_id', ROLLER_ID)

    const uniquePayerIds = [...new Set(currentTasks?.map(t => t.payer_id).filter(Boolean))]

    console.log(`📊 Found ${currentTasks?.length || 0} existing tasks across ${uniquePayerIds.length} payers`)

    // Step 2: Delete all existing tasks
    if (currentTasks && currentTasks.length > 0) {
      const { error: deleteTasksError } = await supabaseAdmin
        .from('provider_credentialing_tasks')
        .delete()
        .eq('provider_id', ROLLER_ID)

      if (deleteTasksError) {
        throw new Error(`Failed to delete tasks: ${deleteTasksError.message}`)
      }

      console.log(`✅ Deleted ${currentTasks.length} old tasks`)
    }

    // Step 3: Delete existing applications
    const { error: deleteAppsError } = await supabaseAdmin
      .from('provider_payer_applications')
      .delete()
      .eq('provider_id', ROLLER_ID)
      .in('payer_id', uniquePayerIds)

    if (deleteAppsError) {
      console.warn('⚠️  Error deleting applications:', deleteAppsError.message)
    }

    // Step 4: Get workflow templates for all payers
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        payer_id,
        workflow_type,
        submission_method,
        task_templates,
        payer:payers(id, name)
      `)
      .in('payer_id', uniquePayerIds)

    if (workflowsError || !workflows) {
      throw new Error(`Failed to fetch workflows: ${workflowsError?.message}`)
    }

    console.log(`📋 Found ${workflows.length} payer workflows`)

    // Step 5: Create new applications
    const applications = uniquePayerIds.map(payerId => ({
      provider_id: ROLLER_ID,
      payer_id: payerId,
      application_status: 'not_started',
      created_by: 'admin@trymoonlit.com'
    }))

    const { data: newApplications, error: appsError } = await supabaseAdmin
      .from('provider_payer_applications')
      .insert(applications)
      .select()

    if (appsError) {
      throw new Error(`Failed to create applications: ${appsError.message}`)
    }

    console.log(`✅ Created ${newApplications?.length || 0} new applications`)

    // Step 6: Generate tasks from payer-specific templates
    const tasksToCreate: any[] = []

    workflows.forEach(workflow => {
      const taskTemplates = workflow.task_templates as any[]

      if (!taskTemplates || taskTemplates.length === 0) {
        console.warn(`⚠️  No task templates for ${workflow.payer?.name}`)
        return
      }

      console.log(`  ✓ ${workflow.payer?.name}: ${taskTemplates.length} tasks (${workflow.workflow_type})`)

      taskTemplates.forEach((template: any) => {
        tasksToCreate.push({
          provider_id: ROLLER_ID,
          payer_id: workflow.payer_id,
          task_type: workflow.workflow_type,
          title: template.title,
          description: template.description || '',
          task_status: 'pending',
          task_order: template.order || 0,
          estimated_days: template.estimated_days || 0,
          created_by: 'admin@trymoonlit.com'
        })
      })
    })

    // Step 7: Insert all new tasks
    const { data: newTasks, error: tasksError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      throw new Error(`Failed to create tasks: ${tasksError.message}`)
    }

    console.log(`✅ Created ${newTasks?.length || 0} new tasks`)

    // Step 8: Verify the fix by comparing to templates
    const verification = workflows.map(w => {
      const templateCount = (w.task_templates as any[])?.length || 0
      const createdCount = newTasks?.filter(t => t.payer_id === w.payer_id).length || 0

      return {
        payer_name: w.payer?.name,
        workflow_type: w.workflow_type,
        submission_method: w.submission_method,
        expected_tasks: templateCount,
        created_tasks: createdCount,
        status: templateCount === createdCount ? '✅ Correct' : '❌ Mismatch'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully fixed Dr. Roller\'s credentialing tasks',
      data: {
        old_tasks_deleted: currentTasks?.length || 0,
        new_tasks_created: newTasks?.length || 0,
        payers_updated: uniquePayerIds.length,
        verification
      }
    })

  } catch (error: any) {
    console.error('❌ Fix failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/debug/fix-roller-tasks
 *
 * Preview what would be changed without actually making changes
 */
export async function GET() {
  try {
    // Get current tasks
    const { data: currentTasks } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select(`
        *,
        payer:payers(name)
      `)
      .eq('provider_id', ROLLER_ID)

    const uniquePayerIds = [...new Set(currentTasks?.map(t => t.payer_id).filter(Boolean))]

    // Get what tasks SHOULD be
    const { data: workflows } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        payer_id,
        workflow_type,
        task_templates,
        payer:payers(name)
      `)
      .in('payer_id', uniquePayerIds)

    // Build preview
    const preview = workflows?.map(w => {
      const currentPayerTasks = currentTasks?.filter(t => t.payer_id === w.payer_id) || []
      const templateTasks = w.task_templates as any[]

      return {
        payer_name: w.payer?.name,
        workflow_type: w.workflow_type,
        current_tasks: currentPayerTasks.map(t => ({
          title: t.title,
          task_order: t.task_order
        })),
        correct_tasks: templateTasks?.map(t => ({
          title: t.title,
          order: t.order
        })) || [],
        needs_fix: currentPayerTasks.length !== templateTasks?.length ||
          !currentPayerTasks.every((ct, i) => ct.title === templateTasks[i]?.title)
      }
    })

    return NextResponse.json({
      success: true,
      preview,
      summary: {
        total_current_tasks: currentTasks?.length || 0,
        payers: uniquePayerIds.length,
        payers_needing_fix: preview?.filter(p => p.needs_fix).length || 0
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

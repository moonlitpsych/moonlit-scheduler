import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ROLLER_ID = '06c5f00f-e2c1-46a7-bad1-55c406b1d190'

export async function GET() {
  try {
    // Get Dr. Roller's info
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role')
      .eq('id', ROLLER_ID)
      .single()

    // Get all tasks for Dr. Roller
    const { data: tasks } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select(`
        *,
        payer:payers(id, name, payer_type)
      `)
      .eq('provider_id', ROLLER_ID)
      .order('payer_id')
      .order('task_order')

    // Get unique payer IDs from tasks
    const payerIds = [...new Set(tasks?.map(t => t.payer_id).filter(Boolean))]

    // Get workflow templates for those payers
    const { data: workflows } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        payer_id,
        workflow_type,
        submission_method,
        contact_type,
        task_templates,
        payer:payers(id, name)
      `)
      .in('payer_id', payerIds)

    // Group tasks by payer for comparison
    const tasksByPayer = new Map()
    tasks?.forEach(task => {
      if (!tasksByPayer.has(task.payer_id)) {
        tasksByPayer.set(task.payer_id, [])
      }
      tasksByPayer.get(task.payer_id).push({
        title: task.title,
        description: task.description,
        task_order: task.task_order,
        task_status: task.task_status,
        created_at: task.created_at
      })
    })

    // Create comparison report
    const comparison = workflows?.map(workflow => {
      const actualTasks = tasksByPayer.get(workflow.payer_id) || []
      const templateTasks = workflow.task_templates || []

      return {
        payer_name: workflow.payer?.name,
        workflow_type: workflow.workflow_type,
        submission_method: workflow.submission_method,
        template_task_count: templateTasks.length,
        actual_task_count: actualTasks.length,
        tasks_match: actualTasks.length === templateTasks.length,
        expected_tasks: templateTasks,
        actual_tasks: actualTasks,
        issue: actualTasks.length !== templateTasks.length
          ? `Expected ${templateTasks.length} tasks from template, but found ${actualTasks.length} tasks`
          : null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        provider,
        total_tasks: tasks?.length || 0,
        payers_with_tasks: payerIds.length,
        comparison,
        raw_data: {
          tasks,
          workflows
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

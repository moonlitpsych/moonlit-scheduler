import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Note: Admin authentication is handled at the page/layout level
// This API route is only accessible via the admin dashboard UI

interface CredentialingTask {
  id: string
  task_type: string
  title: string
  description: string
  task_status: string
  due_date: string | null
  completed_date: string | null
  task_order: number
  notes: string | null
  assigned_to: string | null
  application_id: string | null
}

interface PayerCredentialingProgress {
  payer_id: string
  payer_name: string
  payer_type: string
  requires_individual_contract: boolean

  // Application status
  application_status: string | null
  application_submitted_date: string | null
  approval_date: string | null
  effective_date: string | null

  // Task progress
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  blocked_tasks: number
  completion_percentage: number

  // Tasks list
  tasks: CredentialingTask[]

  // Delegated credentialing: when this payer's credentialing is performed via
  // another payer's process (e.g. HealthyU (UUHP) -> UUHP). The workflow below is
  // inherited from the handler. Contract/booking remain independent.
  credentialing_handled_by?: { id: string; name: string } | null

  // Plans covered by a single credentialing/contract with this payer (tracking
  // only — booking is payer-level). e.g. the UUHP group plans.
  covered_plans?: string[]

  // Workflow details (Phase 2 enhancement)
  workflow?: {
    portal_url: string | null
    submission_method: string | null
    submission_email: string | null
    contact_type: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    form_template_url: string | null
    form_template_filename: string | null
    detailed_instructions: any | null
  }
}

/**
 * GET /api/admin/providers/[providerId]/credentialing-dashboard
 *
 * Returns comprehensive credentialing progress for a provider, grouped by payer.
 * Includes application status, task progress, and individual task details.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await context.params

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Fetching credentialing dashboard for provider ${providerId}...`)

    // Step 1: Verify provider exists
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role, npi')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      console.error('❌ Provider not found:', providerError)
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Step 2: Get all applications for this provider
    const { data: applications, error: applicationsError } = await supabaseAdmin
      .from('provider_payer_applications')
      .select('*')
      .eq('provider_id', providerId)

    if (applicationsError) {
      console.error('❌ Error fetching applications:', applicationsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Step 3: Get all tasks for this provider
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('*')
      .eq('provider_id', providerId)
      .order('payer_id', { ascending: true })
      .order('task_order', { ascending: true })

    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tasks' },
        { status: 500 }
      )
    }

    // Step 4: Get payer details
    const payerIds = [
      ...new Set([
        ...(applications?.map(a => a.payer_id) || []),
        ...(tasks?.map(t => t.payer_id).filter(Boolean) || [])
      ])
    ]

    const { data: payers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, requires_individual_contract, credentialing_handled_by_payer_id')
      .in('id', payerIds)

    if (payersError) {
      console.error('❌ Error fetching payers:', payersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers' },
        { status: 500 }
      )
    }

    const payerMap = new Map(payers?.map(p => [p.id, p]))

    // Step 4b: Get workflow details for payers (Phase 2 enhancement)
    const { data: workflows } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        payer_id,
        portal_url,
        submission_method,
        submission_email,
        contact_type,
        credentialing_contact_name,
        credentialing_contact_email,
        credentialing_contact_phone,
        form_template_url,
        form_template_filename,
        detailed_instructions
      `)
      .in('payer_id', payerIds)

    const workflowMap = new Map(workflows?.map(w => [w.payer_id, w]))

    // Step 4c: Resolve delegated credentialing. Some payers have their
    // credentialing performed via another payer (credentialing_handled_by_payer_id,
    // e.g. HealthyU (UUHP) -> UUHP). Such payers inherit the handler's workflow.
    const handlerIds = [
      ...new Set(
        (payers || [])
          .map(p => p.credentialing_handled_by_payer_id)
          .filter((id): id is string => Boolean(id))
      )
    ]

    const handlerNameMap = new Map<string, string>()
    if (handlerIds.length > 0) {
      const { data: handlerPayers } = await supabaseAdmin
        .from('payers')
        .select('id, name')
        .in('id', handlerIds)
      handlerPayers?.forEach(p => handlerNameMap.set(p.id, p.name))

      // Fetch any handler workflows not already loaded above.
      const missingWorkflowIds = handlerIds.filter(id => !workflowMap.has(id))
      if (missingWorkflowIds.length > 0) {
        const { data: handlerWorkflows } = await supabaseAdmin
          .from('payer_credentialing_workflows')
          .select(`
            payer_id,
            portal_url,
            submission_method,
            submission_email,
            contact_type,
            credentialing_contact_name,
            credentialing_contact_email,
            credentialing_contact_phone,
            form_template_url,
            form_template_filename,
            detailed_instructions
          `)
          .in('payer_id', missingWorkflowIds)
        handlerWorkflows?.forEach(w => workflowMap.set(w.payer_id, w))
      }
    }

    // Step 4d: Plans covered by a single credentialing/contract per payer
    // (tracking only — booking is payer-level).
    const { data: payerPlans } = await supabaseAdmin
      .from('payer_plans')
      .select('payer_id, plan_name')
      .in('payer_id', payerIds)
      .eq('is_active', true)

    const coveredPlansMap = new Map<string, string[]>()
    payerPlans?.forEach(pl => {
      const list = coveredPlansMap.get(pl.payer_id) || []
      list.push(pl.plan_name)
      coveredPlansMap.set(pl.payer_id, list)
    })

    // Step 5: Group tasks by payer
    const tasksByPayer = new Map<string, CredentialingTask[]>()
    tasks?.forEach(task => {
      if (!task.payer_id) return

      if (!tasksByPayer.has(task.payer_id)) {
        tasksByPayer.set(task.payer_id, [])
      }

      tasksByPayer.get(task.payer_id)!.push({
        id: task.id,
        task_type: task.task_type,
        title: task.title,
        description: task.description || '',
        task_status: task.task_status,
        due_date: task.due_date,
        completed_date: task.completed_date,
        task_order: task.task_order || 0,
        notes: task.notes,
        assigned_to: task.assigned_to,
        application_id: task.application_id
      })
    })

    // Step 6: Build progress data per payer
    const progress: PayerCredentialingProgress[] = []

    // Combine data from applications and tasks
    const allPayerIds = new Set([
      ...(applications?.map(a => a.payer_id) || []),
      ...Array.from(tasksByPayer.keys())
    ])

    allPayerIds.forEach(payerId => {
      const payer = payerMap.get(payerId)
      if (!payer) return

      const application = applications?.find(a => a.payer_id === payerId)
      const payerTasks = tasksByPayer.get(payerId) || []

      // A delegated payer inherits its handler's workflow; otherwise use its own.
      const handlerId = payer.credentialing_handled_by_payer_id
      const workflow = handlerId ? workflowMap.get(handlerId) : workflowMap.get(payerId)
      const handledBy = handlerId
        ? { id: handlerId, name: handlerNameMap.get(handlerId) || payerMap.get(handlerId)?.name || 'Another payer' }
        : null

      // Calculate task statistics
      const totalTasks = payerTasks.length
      const completedTasks = payerTasks.filter(t => t.task_status === 'completed').length
      const inProgressTasks = payerTasks.filter(t => t.task_status === 'in_progress').length
      const pendingTasks = payerTasks.filter(t => t.task_status === 'pending').length
      const blockedTasks = payerTasks.filter(t => t.task_status === 'blocked').length

      const completionPercentage = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0

      progress.push({
        payer_id: payerId,
        payer_name: payer.name,
        payer_type: payer.payer_type,
        requires_individual_contract: payer.requires_individual_contract || false,

        application_status: application?.application_status || null,
        application_submitted_date: application?.application_submitted_date || null,
        approval_date: application?.approval_date || null,
        effective_date: application?.effective_date || null,

        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        pending_tasks: pendingTasks,
        blocked_tasks: blockedTasks,
        completion_percentage: completionPercentage,

        tasks: payerTasks,

        credentialing_handled_by: handledBy,
        covered_plans: coveredPlansMap.get(payerId) || [],

        // Include workflow data (Phase 2 enhancement)
        workflow: workflow ? {
          portal_url: workflow.portal_url,
          submission_method: workflow.submission_method,
          submission_email: workflow.submission_email,
          contact_type: workflow.contact_type,
          contact_name: workflow.credentialing_contact_name,
          contact_email: workflow.credentialing_contact_email,
          contact_phone: workflow.credentialing_contact_phone,
          form_template_url: workflow.form_template_url,
          form_template_filename: workflow.form_template_filename,
          detailed_instructions: workflow.detailed_instructions
        } : undefined
      })
    })

    // Sort by completion percentage (descending) then by payer name
    progress.sort((a, b) => {
      if (a.completion_percentage !== b.completion_percentage) {
        return b.completion_percentage - a.completion_percentage
      }
      return a.payer_name.localeCompare(b.payer_name)
    })

    // Calculate overall statistics
    const overallStats = {
      total_payers: progress.length,
      total_tasks: progress.reduce((sum, p) => sum + p.total_tasks, 0),
      completed_tasks: progress.reduce((sum, p) => sum + p.completed_tasks, 0),
      in_progress_payers: progress.filter(p => p.in_progress_tasks > 0).length,
      approved_payers: progress.filter(p => p.application_status === 'approved').length,
      pending_approval: progress.filter(p =>
        p.application_status === 'submitted' || p.application_status === 'under_review'
      ).length
    }

    console.log(`✅ Returning credentialing dashboard for ${provider.first_name} ${provider.last_name}`)

    return NextResponse.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          first_name: provider.first_name,
          last_name: provider.last_name,
          role: provider.role,
          npi: provider.npi
        },
        overall_stats: overallStats,
        payers: progress
      }
    })

  } catch (error) {
    console.error('❌ Credentialing dashboard API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

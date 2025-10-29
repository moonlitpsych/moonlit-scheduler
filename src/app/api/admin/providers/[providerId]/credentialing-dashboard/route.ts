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
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

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
      .select('id, name, payer_type, requires_individual_contract')
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
      const workflow = workflowMap.get(payerId)

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

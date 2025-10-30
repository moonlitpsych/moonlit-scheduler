import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/providers/[providerId]/credential-payers
 *
 * Generates credentialing tasks for a provider based on selected payers.
 * Uses payer-specific task templates from payer_credentialing_workflows table.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ providerId: string }> }
) {
  try {
    const { providerId } = await context.params
    const body = await request.json()
    const { payerIds } = body

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    if (!payerIds || !Array.isArray(payerIds) || payerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one payer ID is required' },
        { status: 400 }
      )
    }

    console.log(`📝 Generating credentialing tasks for provider ${providerId} with ${payerIds.length} payers...`)

    // Step 1: Verify provider exists
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, role')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      console.error('❌ Provider not found:', providerError)
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Step 2: Get workflow templates for selected payers
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        payer_id,
        workflow_type,
        task_templates,
        payer:payers(id, name)
      `)
      .in('payer_id', payerIds)

    if (workflowsError) {
      console.error('❌ Error fetching workflows:', workflowsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payer workflows' },
        { status: 500 }
      )
    }

    if (!workflows || workflows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No workflows found for selected payers' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${workflows.length} payer workflows`)

    // Step 3: Check for existing tasks/applications
    const { data: existingTasks } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('payer_id')
      .eq('provider_id', providerId)
      .in('payer_id', payerIds)

    const existingPayerIds = new Set(existingTasks?.map(t => t.payer_id) || [])

    if (existingPayerIds.size > 0) {
      const existingPayerNames = workflows
        .filter(w => existingPayerIds.has(w.payer_id))
        .map(w => w.payer?.name)
        .filter(Boolean)

      console.log(`⚠️  Provider already has tasks for: ${existingPayerNames.join(', ')}`)

      return NextResponse.json(
        {
          success: false,
          error: `Provider already has credentialing tasks for: ${existingPayerNames.join(', ')}. Delete existing tasks first if you want to regenerate them.`,
          existing_payers: Array.from(existingPayerIds)
        },
        { status: 409 }
      )
    }

    // Step 4: Create applications for each payer
    const applications = payerIds.map(payerId => ({
      provider_id: providerId,
      payer_id: payerId,
      application_status: 'not_started',
      created_by: 'admin@trymoonlit.com'
    }))

    const { data: createdApplications, error: applicationsError } = await supabaseAdmin
      .from('provider_payer_applications')
      .insert(applications)
      .select()

    if (applicationsError) {
      console.error('❌ Error creating applications:', applicationsError)
      return NextResponse.json(
        { success: false, error: 'Failed to create applications' },
        { status: 500 }
      )
    }

    console.log(`✅ Created ${createdApplications?.length || 0} applications`)

    // Step 5: Generate tasks from payer-specific templates
    const tasksToCreate: any[] = []

    workflows.forEach(workflow => {
      const taskTemplates = workflow.task_templates as any[]

      if (!taskTemplates || taskTemplates.length === 0) {
        console.warn(`⚠️  No task templates found for payer ${workflow.payer?.name}`)
        return
      }

      console.log(`📋 Generating ${taskTemplates.length} tasks for ${workflow.payer?.name} (${workflow.workflow_type})`)

      taskTemplates.forEach((template: any) => {
        tasksToCreate.push({
          provider_id: providerId,
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

    if (tasksToCreate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tasks to create - check payer workflow templates' },
        { status: 400 }
      )
    }

    // Step 6: Insert all tasks
    const { data: createdTasks, error: tasksError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .insert(tasksToCreate)
      .select()

    if (tasksError) {
      console.error('❌ Error creating tasks:', tasksError)
      return NextResponse.json(
        { success: false, error: 'Failed to create tasks', details: tasksError.message },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully created ${createdTasks?.length || 0} credentialing tasks`)

    // Step 7: Return summary
    const summary = workflows.map(w => ({
      payer_name: w.payer?.name,
      payer_id: w.payer_id,
      workflow_type: w.workflow_type,
      tasks_created: (w.task_templates as any[])?.length || 0
    }))

    return NextResponse.json({
      success: true,
      message: `Created ${createdTasks?.length} credentialing tasks for ${provider.first_name} ${provider.last_name}`,
      data: {
        provider: {
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`
        },
        applicationsCreated: createdApplications?.length || 0,
        tasksCreated: createdTasks?.length || 0,
        payers: summary
      }
    })

  } catch (error: any) {
    console.error('❌ Credential payers API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

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

interface TaskTemplate {
  title: string
  description: string
  order: number
  estimated_days: number
}

/**
 * POST /api/admin/providers/[providerId]/credential-payers
 *
 * Creates credentialing tasks and application records for selected payers.
 * Tasks are generated based on each payer's credentialing workflow type.
 *
 * Request body:
 * {
 *   payerIds: string[]
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     tasksCreated: number,
 *     applicationsCreated: number,
 *     details: Array<{ payerId, taskCount, applicationId }>
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ providerId: string }> }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { providerId } = await context.params
    const body = await request.json()
    const { payerIds } = body as { payerIds: string[] }

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: 'Provider ID is required' },
        { status: 400 }
      )
    }

    if (!payerIds || !Array.isArray(payerIds) || payerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'payerIds array is required and must not be empty' },
        { status: 400 }
      )
    }

    console.log(`🔄 Creating credentialing tasks for provider ${providerId} with ${payerIds.length} payers...`)

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

    // Step 2: Get credentialing workflows for selected payers
    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select('*')
      .in('payer_id', payerIds)

    if (workflowsError) {
      console.error('❌ Error fetching workflows:', workflowsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch credentialing workflows' },
        { status: 500 }
      )
    }

    // Step 3: Get payer information
    const { data: payers, error: payersError } = await supabaseAdmin
      .from('payers')
      .select('id, name, requires_individual_contract')
      .in('id', payerIds)

    if (payersError) {
      console.error('❌ Error fetching payers:', payersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers' },
        { status: 500 }
      )
    }

    const payerMap = new Map(payers?.map(p => [p.id, p]))
    const workflowMap = new Map(workflows?.map(w => [w.payer_id, w]))

    let totalTasksCreated = 0
    let totalApplicationsCreated = 0
    const details: Array<{ payerId: string, payerName: string, taskCount: number, applicationId: string | null }> = []

    // Step 4: For each payer, create application record and tasks
    for (const payerId of payerIds) {
      const payer = payerMap.get(payerId)
      const workflow = workflowMap.get(payerId)

      if (!payer) {
        console.warn(`⚠️ Skipping unknown payer: ${payerId}`)
        continue
      }

      // Create application record (idempotent - uses upsert)
      const { data: application, error: appError } = await supabaseAdmin
        .from('provider_payer_applications')
        .upsert({
          provider_id: providerId,
          payer_id: payerId,
          application_status: 'not_started',
          application_started_date: new Date().toISOString().split('T')[0],
          created_by: user?.email || 'admin'
        }, {
          onConflict: 'provider_id,payer_id',
          ignoreDuplicates: false // Update if already exists
        })
        .select()
        .single()

      if (appError) {
        console.error(`❌ Error creating application for payer ${payer.name}:`, appError)
        continue
      }

      totalApplicationsCreated++

      // Generate tasks based on workflow type
      const tasks: any[] = []

      if (workflow && workflow.task_templates) {
        // Use workflow-specific task templates
        const templates = workflow.task_templates as TaskTemplate[]

        console.log(`🔍 DEBUG for ${payer.name}:`, {
          workflow_id: workflow.id,
          workflow_type: workflow.workflow_type,
          templates_raw: workflow.task_templates,
          templates_cast: templates,
          first_template: templates[0],
          has_title: templates[0]?.hasOwnProperty('title'),
          title_value: templates[0]?.title,
          title_type: typeof templates[0]?.title
        })

        templates.forEach((template, index) => {
          const dueDate = template.estimated_days > 0
            ? new Date(Date.now() + template.estimated_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null

          tasks.push({
            provider_id: providerId,
            payer_id: payerId,
            task_type: 'workflow_task',
            title: template.title,
            description: template.description,
            task_status: 'pending',
            task_order: template.order || index + 1,
            due_date: dueDate,
            estimated_days: template.estimated_days,
            created_by: user?.email || 'admin'
          })
        })
      } else {
        // Fallback: Create default tasks based on workflow type
        const workflowType = workflow?.workflow_type || 'online_portal'

        switch (workflowType) {
          case 'instant_network':
            tasks.push({
              provider_id: providerId,
              payer_id: payerId,
              task_type: 'roster_notification',
              title: 'Notify payer of provider addition',
              description: `Contact ${payer.name} to add ${provider.first_name} ${provider.last_name} to roster (no individual contract required)`,
              task_status: 'pending',
              task_order: 1,
              estimated_days: 1,
              created_by: user?.email || 'admin'
            })
            break

          case 'excel_submission':
            tasks.push(
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'download_template',
                title: 'Download Excel roster template',
                description: `Get the latest provider roster template from ${payer.name}`,
                task_status: 'pending',
                task_order: 1,
                estimated_days: 0,
                created_by: user?.email || 'admin'
              },
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'fill_template',
                title: 'Add provider to Excel roster',
                description: `Add ${provider.first_name} ${provider.last_name}'s information to the roster template`,
                task_status: 'pending',
                task_order: 2,
                estimated_days: 1,
                created_by: user?.email || 'admin'
              },
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'submit_roster',
                title: 'Submit roster to payer',
                description: `Email completed roster to ${payer.name} credentialing team`,
                task_status: 'pending',
                task_order: 3,
                estimated_days: 0,
                created_by: user?.email || 'admin'
              }
            )
            break

          case 'online_portal':
          default:
            tasks.push(
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'portal_credentials',
                title: 'Obtain portal credentials',
                description: `Get login credentials for ${payer.name} credentialing portal`,
                task_status: 'pending',
                task_order: 1,
                estimated_days: 1,
                created_by: user?.email || 'admin'
              },
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'submit_application',
                title: 'Submit provider application',
                description: `Complete and submit application for ${provider.first_name} ${provider.last_name} in ${payer.name} portal`,
                task_status: 'pending',
                task_order: 2,
                estimated_days: 2,
                created_by: user?.email || 'admin'
              },
              {
                provider_id: providerId,
                payer_id: payerId,
                task_type: 'record_application_id',
                title: 'Record application ID',
                description: 'Save application reference number from portal confirmation',
                task_status: 'pending',
                task_order: 3,
                estimated_days: 0,
                created_by: user?.email || 'admin'
              }
            )
            break
        }
      }

      // Insert tasks (skip duplicates)
      if (tasks.length > 0) {
        const { data: createdTasks, error: tasksError } = await supabaseAdmin
          .from('provider_credentialing_tasks')
          .insert(tasks)
          .select()

        if (tasksError) {
          console.error(`❌ Error creating tasks for payer ${payer.name}:`, tasksError)
          // Continue with other payers
        } else {
          totalTasksCreated += createdTasks?.length || 0
          console.log(`✅ Created ${createdTasks?.length} tasks for ${payer.name}`)
        }
      }

      details.push({
        payerId: payerId,
        payerName: payer.name,
        taskCount: tasks.length,
        applicationId: application.id
      })
    }

    console.log(`✅ Credentialing setup complete: ${totalTasksCreated} tasks, ${totalApplicationsCreated} applications`)

    return NextResponse.json({
      success: true,
      data: {
        tasksCreated: totalTasksCreated,
        applicationsCreated: totalApplicationsCreated,
        details
      }
    })

  } catch (error) {
    console.error('❌ Credential payers API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

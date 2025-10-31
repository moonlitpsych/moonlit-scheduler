import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ROLLER_ID = '06c5f00f-e2c1-46a7-bad1-55c406b1d190'

/**
 * POST /api/debug/add-contract-steps
 *
 * Adds contract signing steps to payer workflows and regenerates Dr. Roller's tasks
 */
export async function POST() {
  try {
    console.log('📝 Adding contract signing steps to payer workflows...')

    // List of payers that need contract steps
    const payersNeedingContracts = [
      { name: 'Regence BlueCross BlueShield', type: 'pdf' },
      { name: 'SelectHealth Integrated', type: 'pdf' },
      { name: 'HMHI BHN', type: 'pdf' },
      { name: 'Health Choice Utah', type: 'pdf' },
      { name: 'Molina Utah', type: 'excel' },
      { name: 'University of Utah Health Plans (UUHP)', type: 'portal' }
    ]

    const updates = []

    for (const payer of payersNeedingContracts) {
      // Look up payer by name
      const { data: payerRecord } = await supabaseAdmin
        .from('payers')
        .select('id, name')
        .eq('name', payer.name)
        .single()

      if (!payerRecord) {
        console.warn(`⚠️  Payer not found: ${payer.name}`)
        continue
      }

      // Get current workflow
      const { data: workflow } = await supabaseAdmin
        .from('payer_credentialing_workflows')
        .select('payer_id, task_templates')
        .eq('payer_id', payerRecord.id)
        .single()

      if (!workflow) {
        console.warn(`⚠️  No workflow found for ${payer.name}`)
        continue
      }

      const currentTasks = workflow.task_templates as any[]

      // Add contract steps if not already present
      const hasContractStep = currentTasks.some(t =>
        t.title?.toLowerCase().includes('contract') ||
        t.title?.toLowerCase().includes('sign')
      )

      if (hasContractStep) {
        console.log(`✓ ${payer.name} already has contract steps`)
        continue
      }

      // Add the two new tasks
      const newTasks = [
        ...currentTasks,
        {
          order: currentTasks.length + 1,
          title: `Wait for contract from ${payer.name.replace(' (UUHP)', '')}`,
          description: `Monitor email for contract documents from ${payer.name.replace(' (UUHP)', '')} credentialing team. Typical response time: 30-60 days`,
          estimated_days: 45
        },
        {
          order: currentTasks.length + 2,
          title: `Sign and return contract to ${payer.name.replace(' (UUHP)', '')}`,
          description: `Review contract terms, sign, and return to ${payer.name.replace(' (UUHP)', '')}`,
          estimated_days: 2
        }
      ]

      // Update workflow
      const { error } = await supabaseAdmin
        .from('payer_credentialing_workflows')
        .update({ task_templates: newTasks })
        .eq('payer_id', workflow.payer_id)

      if (error) {
        console.error(`❌ Error updating ${payer.name}:`, error)
      } else {
        console.log(`✅ Added contract steps to ${payer.name} (${currentTasks.length} → ${newTasks.length} tasks)`)
        updates.push({
          payer: payer.name,
          old_task_count: currentTasks.length,
          new_task_count: newTasks.length
        })
      }
    }

    console.log(`\n🔄 Regenerating Dr. Roller's tasks...`)

    // Delete Dr. Roller's existing tasks for updated payers
    const { data: tasksToDelete } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .select('id, payer_id, payer:payers(name)')
      .eq('provider_id', ROLLER_ID)

    const payerNames = updates.map(u => u.payer)
    const payerIdsToUpdate = tasksToDelete
      ?.filter(t => payerNames.includes(t.payer?.name))
      .map(t => t.payer_id) || []

    if (payerIdsToUpdate.length === 0) {
      console.log('⚠️  No tasks found to regenerate')
      return NextResponse.json({
        success: true,
        message: 'Contract steps added to workflows',
        data: { updates, tasks_regenerated: 0 }
      })
    }

    // Delete old tasks for these payers
    const { error: deleteError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .delete()
      .eq('provider_id', ROLLER_ID)
      .in('payer_id', payerIdsToUpdate)

    if (deleteError) {
      throw new Error(`Failed to delete old tasks: ${deleteError.message}`)
    }

    console.log(`✅ Deleted old tasks for ${payerIdsToUpdate.length} payers`)

    // Get updated workflows
    const { data: updatedWorkflows } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select('payer_id, workflow_type, task_templates, payer:payers(name)')
      .in('payer_id', payerIdsToUpdate)

    // Generate new tasks
    const newTasks: any[] = []

    updatedWorkflows?.forEach(workflow => {
      const templates = workflow.task_templates as any[]

      templates.forEach(template => {
        newTasks.push({
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

    const { data: createdTasks, error: createError } = await supabaseAdmin
      .from('provider_credentialing_tasks')
      .insert(newTasks)
      .select()

    if (createError) {
      throw new Error(`Failed to create new tasks: ${createError.message}`)
    }

    console.log(`✅ Created ${createdTasks?.length} new tasks`)

    return NextResponse.json({
      success: true,
      message: 'Successfully added contract steps and regenerated tasks',
      data: {
        workflows_updated: updates,
        payers_regenerated: payerIdsToUpdate.length,
        old_tasks_deleted: tasksToDelete?.filter(t => payerIdsToUpdate.includes(t.payer_id)).length,
        new_tasks_created: createdTasks?.length
      }
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

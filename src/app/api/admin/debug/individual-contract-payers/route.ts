import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Find payers where requires_individual_contract = true
    const { data: payers, error } = await supabaseAdmin
      .from('payers')
      .select('id, name, payer_type, state, requires_individual_contract, requires_attending, allows_supervised')
      .eq('requires_individual_contract', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching payers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check which ones already have workflows
    const payerIds = payers?.map(p => p.id) || []
    const { data: existingWorkflows, error: workflowError } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select('payer_id, workflow_type')
      .in('payer_id', payerIds)

    if (workflowError) {
      console.error('Error fetching workflows:', workflowError)
    }

    const workflowMap = new Map(existingWorkflows?.map(w => [w.payer_id, w.workflow_type]) || [])

    const payersWithStatus = payers?.map(p => ({
      ...p,
      has_workflow: workflowMap.has(p.id),
      workflow_type: workflowMap.get(p.id) || null
    }))

    const needsWorkflow = payersWithStatus?.filter(p => !p.has_workflow) || []

    return NextResponse.json({
      success: true,
      total: payers?.length || 0,
      needs_workflow: needsWorkflow.length,
      payers: payersWithStatus || [],
      payers_needing_workflow: needsWorkflow
    })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get workflows for the 7 failing payers
    const failingPayerNames = [
      'HMHI BHN',
      'Health Choice Utah',
      'Optum Commercial Behavioral Health',
      'Optum Salt Lake and Tooele County Medicaid Network',
      'Regence BlueCross BlueShield',
      'SelectHealth Integrated',
      'TriCare West'
    ]

    const { data: payers } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .in('name', failingPayerNames)

    const payerIds = payers?.map(p => p.id) || []

    const { data: workflows } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select('*')
      .in('payer_id', payerIds)

    // Check what the API actually sees
    const debug = workflows?.map(w => {
      const templates = w.task_templates as any[]
      return {
        payer_id: w.payer_id,
        workflow_type: w.workflow_type,
        templates_raw: w.task_templates,
        templates_array: templates,
        first_template: templates?.[0],
        has_title: templates?.[0]?.hasOwnProperty('title'),
        title_value: templates?.[0]?.title,
        title_type: typeof templates?.[0]?.title
      }
    })

    return NextResponse.json({
      success: true,
      payers,
      workflows: debug
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

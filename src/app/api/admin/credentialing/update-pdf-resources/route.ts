import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Update payer credentialing workflows with PDF form URLs from Supabase Storage
 *
 * POST /api/admin/credentialing/update-pdf-resources
 */
export async function POST() {
  try {
    console.log('📄 Updating credentialing workflows with PDF resources...')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    // Map of payer names to their form filenames in credentialing-resources bucket
    const credentialingResources = [
      {
        payerName: 'Health Choice Utah',
        filename: 'Health_Choice_Utah_initial_Provider Demographic Request Form - Fillable .pdf',
        displayName: 'Provider Demographic Request Form (Fillable)',
        workflowType: 'pdf_form_submission'
      },
      {
        payerName: 'HMHI BHN',
        filename: 'HMHI_BHN_initial_Clinical Description Services Form 2025 Fillable.pdf',
        displayName: 'Clinical Description Services Form 2025 (Fillable)',
        workflowType: 'pdf_form_submission'
      },
      {
        payerName: 'Regence BlueCross BlueShield',
        filename: 'Regence_BCBS_initial_Practitioner-Credentialing-Regence.pdf',
        displayName: 'Practitioner Credentialing Form',
        workflowType: 'pdf_form_submission'
      },
      {
        payerName: 'SelectHealth Integrated',
        filename: 'SelectHealth_initial_Provider Participation Request Form.pdf',
        displayName: 'Provider Participation Request Form',
        workflowType: 'pdf_form_submission'
      },
      {
        payerName: 'Molina Utah',
        filename: 'MOLINA_initial_Provider Roster.xlsx',
        displayName: 'Provider Roster Spreadsheet',
        workflowType: 'excel_submission'
      }
    ]

    const updates = []

    for (const resource of credentialingResources) {
      // Find the payer
      const { data: payer, error: payerError } = await supabaseAdmin
        .from('payers')
        .select('id, name')
        .ilike('name', resource.payerName)
        .single()

      if (payerError || !payer) {
        console.log(`⚠️ Payer not found: ${resource.payerName}`)
        updates.push({
          payerName: resource.payerName,
          status: 'payer_not_found',
          error: payerError?.message
        })
        continue
      }

      // Generate public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/credentialing-resources/${encodeURIComponent(resource.filename)}`

      // Update the workflow
      const { data: workflow, error: updateError } = await supabaseAdmin
        .from('payer_credentialing_workflows')
        .update({
          form_template_url: publicUrl,
          form_template_filename: resource.displayName,
          updated_at: new Date().toISOString()
        })
        .eq('payer_id', payer.id)
        .eq('workflow_type', resource.workflowType)
        .select()
        .single()

      if (updateError) {
        console.error(`❌ Error updating workflow for ${resource.payerName}:`, updateError)
        updates.push({
          payerName: resource.payerName,
          payerId: payer.id,
          status: 'update_failed',
          error: updateError.message
        })
        continue
      }

      console.log(`✅ Updated workflow for ${resource.payerName}`)
      updates.push({
        payerName: resource.payerName,
        payerId: payer.id,
        status: 'success',
        url: publicUrl,
        workflowId: workflow.id
      })
    }

    const successCount = updates.filter(u => u.status === 'success').length
    const failureCount = updates.filter(u => u.status !== 'success').length

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} workflows with credentialing resources (PDF/Excel)`,
      data: {
        total_processed: credentialingResources.length,
        successful: successCount,
        failed: failureCount,
        updates
      }
    })

  } catch (error: any) {
    console.error('❌ Error updating PDF resources:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET - Show current PDF/Excel resources status
 */
export async function GET() {
  try {
    const { data: workflows, error } = await supabaseAdmin
      .from('payer_credentialing_workflows')
      .select(`
        id,
        workflow_type,
        form_template_url,
        form_template_filename,
        payer:payers(id, name)
      `)
      .in('workflow_type', ['pdf_form_submission', 'excel_submission'])
      .order('payer(name)')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        workflows: workflows?.map(w => ({
          payer: (w.payer as any)?.name,
          workflow_type: w.workflow_type,
          has_resource: !!w.form_template_url,
          url: w.form_template_url,
          filename: w.form_template_filename
        }))
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

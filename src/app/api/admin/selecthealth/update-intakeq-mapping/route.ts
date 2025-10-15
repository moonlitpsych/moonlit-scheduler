// Admin API endpoint to update SelectHealth service_instance IntakeQ mapping
// POST /api/admin/selecthealth/update-intakeq-mapping

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔧 Updating SelectHealth Intake service IntakeQ mapping...')

    const selectHealthIntakeInstanceId = '2300e6bb-0fed-4550-9d92-916b8168eff6'
    const selectHealthPracticeQServiceId = '4a8c9634-3449-4fde-94fe-5de7dc6c9dc8'

    // Update the service_instance_integrations mapping
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('service_instance_integrations')
      .update({
        external_id: selectHealthPracticeQServiceId
      })
      .eq('service_instance_id', selectHealthIntakeInstanceId)
      .eq('system', 'intakeq')
      .select()

    if (updateError) {
      console.error('❌ Failed to update IntakeQ mapping:', updateError)
      return NextResponse.json(
        { success: false, error: `Failed to update mapping: ${updateError.message}` },
        { status: 500 }
      )
    }

    if (!updated || updated.length === 0) {
      console.error('❌ No mapping found to update')
      return NextResponse.json(
        { success: false, error: 'No IntakeQ mapping found for SelectHealth Intake service' },
        { status: 404 }
      )
    }

    console.log(`✅ Updated IntakeQ mapping for SelectHealth Intake:`)
    console.log(`   Service Instance: ${selectHealthIntakeInstanceId}`)
    console.log(`   New PracticeQ Service: ${selectHealthPracticeQServiceId}`)

    // Verify the update
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .eq('service_instance_id', selectHealthIntakeInstanceId)
      .eq('system', 'intakeq')
      .single()

    if (verifyError) {
      console.warn('⚠️ Could not verify update:', verifyError)
    }

    return NextResponse.json({
      success: true,
      message: 'Updated SelectHealth Intake IntakeQ mapping to SelectHealth Medicaid service',
      old_service_id: '137bcec9-6d59-4cd8-910f-a1d9c0616319',
      new_service_id: selectHealthPracticeQServiceId,
      service_instance_id: selectHealthIntakeInstanceId,
      updated: updated[0],
      verification
    })

  } catch (error: any) {
    console.error('❌ Error updating IntakeQ mapping:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check current mapping
export async function GET() {
  try {
    const selectHealthIntakeInstanceId = '2300e6bb-0fed-4550-9d92-916b8168eff6'

    const { data: mapping, error } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .eq('service_instance_id', selectHealthIntakeInstanceId)
      .eq('system', 'intakeq')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const isCorrect = mapping?.external_id === '4a8c9634-3449-4fde-94fe-5de7dc6c9dc8'

    return NextResponse.json({
      success: true,
      service_instance_id: selectHealthIntakeInstanceId,
      current_mapping: mapping,
      is_correct_service: isCorrect,
      expected_service_id: '4a8c9634-3449-4fde-94fe-5de7dc6c9dc8',
      actual_service_id: mapping?.external_id
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

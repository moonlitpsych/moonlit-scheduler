// Update cash service instance to use out-of-pocket IntakeQ service
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const cashServiceInstanceId = '1e2c8ef7-84ae-49af-bafd-01efc16757a8'
    const oopIntakeqServiceId = '2d212ea8-de91-4aa9-aff9-9ba0feab0137' // Out-of-pocket service
    const insuranceIntakeqServiceId = '137bcec9-6d59-4cd8-910f-a1d9c0616319' // Old insurance service

    // Check current mapping
    const { data: currentMapping, error: checkError } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .eq('service_instance_id', cashServiceInstanceId)
      .eq('system', 'intakeq')
      .single()

    if (checkError) {
      throw new Error(`Failed to fetch current mapping: ${checkError.message}`)
    }

    console.log('📋 Current mapping:', currentMapping)

    if (currentMapping.external_id === oopIntakeqServiceId) {
      return NextResponse.json({
        success: true,
        message: 'Mapping already points to out-of-pocket service',
        mapping: currentMapping,
        noChangeNeeded: true
      })
    }

    // Update the mapping
    const { data: updatedMapping, error: updateError } = await supabaseAdmin
      .from('service_instance_integrations')
      .update({
        external_id: oopIntakeqServiceId
      })
      .eq('service_instance_id', cashServiceInstanceId)
      .eq('system', 'intakeq')
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: 'Updated cash service mapping to out-of-pocket IntakeQ service',
      before: {
        external_id: currentMapping.external_id,
        service: currentMapping.external_id === insuranceIntakeqServiceId
          ? 'New Patient Visit (insurance)'
          : 'Unknown'
      },
      after: {
        external_id: updatedMapping.external_id,
        service: 'New Patient Visit (out-of-pocket)'
      },
      mapping: updatedMapping
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

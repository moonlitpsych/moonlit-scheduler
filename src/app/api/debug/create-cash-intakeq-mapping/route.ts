// Create IntakeQ mapping for cash payment service instance
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const cashServiceInstanceId = '1e2c8ef7-84ae-49af-bafd-01efc16757a8'
    const intakeqServiceId = '2d212ea8-de91-4aa9-aff9-9ba0feab0137' // Out-of-pocket service

    // Check if mapping already exists
    const { data: existing } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .eq('service_instance_id', cashServiceInstanceId)
      .eq('system', 'intakeq')
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Mapping already exists',
        mapping: existing
      })
    }

    // Create the mapping
    const { data: newMapping, error } = await supabaseAdmin
      .from('service_instance_integrations')
      .insert({
        service_instance_id: cashServiceInstanceId,
        system: 'intakeq',
        external_id: intakeqServiceId
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Cash payment IntakeQ mapping created successfully!',
      mapping: newMapping,
      details: {
        cashServiceInstance: cashServiceInstanceId,
        intakeqServiceId: intakeqServiceId,
        note: 'Cash bookings will now sync to IntakeQ using the out-of-pocket service'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

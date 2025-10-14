// Find IntakeQ service ID used for successful booking
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const appointmentId = request.nextUrl.searchParams.get('appointment_id') || '36f32178-fa37-48b0-9034-303c4b8e832e'

    // Get appointment with service_instance_id
    const { data: appointment, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, service_instance_id, pq_appointment_id, provider_id')
      .eq('id', appointmentId)
      .single()

    if (apptError) throw apptError

    // Get IntakeQ mapping for this service instance
    const { data: mapping } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('external_id, system')
      .eq('service_instance_id', appointment.service_instance_id)
      .eq('system', 'intakeq')
      .single()

    // Get provider IntakeQ settings
    const { data: providerIntakeq } = await supabaseAdmin
      .from('provider_intakeq_settings')
      .select('*')
      .eq('provider_id', appointment.provider_id)
      .single()

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        service_instance_id: appointment.service_instance_id,
        pq_appointment_id: appointment.pq_appointment_id
      },
      intakeqMapping: mapping,
      providerIntakeqSettings: providerIntakeq,
      recommendation: mapping
        ? `Use IntakeQ service ID: ${mapping.external_id} for cash payment mapping`
        : 'No mapping found - check provider_intakeq_settings.service_id instead'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

// Debug: Check IntakeQ service instance mappings
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get all intake service instances with their IntakeQ mappings
    const { data: mappings, error } = await supabaseAdmin
      .from('service_instance_integrations')
      .select(`
        service_instance_id,
        system,
        external_id,
        service_instances!inner(
          id,
          payer_id,
          services!inner(
            id,
            name,
            duration_minutes
          )
        )
      `)
      .eq('system', 'intakeq')
      .in('service_instances.services.name', [' Intake', 'Intake', 'New Patient Visit'])

    if (error) throw error

    // Group by service name
    const byServiceName = mappings?.reduce((acc: any, m: any) => {
      const serviceName = m.service_instances.services.name
      if (!acc[serviceName]) acc[serviceName] = []
      acc[serviceName].push({
        service_instance_id: m.service_instance_id,
        payer_id: m.service_instances.payer_id || 'NULL (cash/all payers)',
        intakeq_service_id: m.external_id,
        duration: m.service_instances.services.duration_minutes
      })
      return acc
    }, {})

    // Check if cash service instance exists
    const { data: cashInstance } = await supabaseAdmin
      .from('service_instances')
      .select('id, payer_id, service_id, services(name, duration_minutes)')
      .eq('id', '1e2c8ef7-84ae-49af-bafd-01efc16757a8')
      .single()

    return NextResponse.json({
      success: true,
      cashServiceInstance: cashInstance,
      existingMappings: byServiceName,
      recommendation: {
        message: 'Use the most common IntakeQ service ID for Intake services',
        suggestedServiceId: mappings?.[0]?.external_id || 'Unknown - check manually'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}

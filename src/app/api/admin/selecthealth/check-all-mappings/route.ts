// Admin endpoint to check all SelectHealth service IntakeQ mappings
// GET /api/admin/selecthealth/check-all-mappings

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const selectHealthId = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'

    // Get all service_instances with their IntakeQ mappings
    const { data: instances, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        id,
        service_id,
        payer_id,
        location,
        active,
        services!inner(id, name),
        service_instance_integrations!left(
          id,
          system,
          external_id
        )
      `)
      .eq('payer_id', selectHealthId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const mappings = instances?.map(inst => {
      const intakeqMapping = inst.service_instance_integrations?.find((i: any) => i.system === 'intakeq')
      return {
        service_instance_id: inst.id,
        service_name: inst.services.name,
        intakeq_service_id: intakeqMapping?.external_id || 'NOT MAPPED',
        has_mapping: !!intakeqMapping,
        active: inst.active
      }
    })

    // Expected mappings
    const expected = {
      intake: '4a8c9634-3449-4fde-94fe-5de7dc6c9dc8', // SelectHealth Medicaid service
      followup_short: '436ebccd-7e5b-402d-9f13-4c5733e3af8c',
      followup_extended: 'f0490d0a-992f-4f14-836f-0e41e11be14d'
    }

    return NextResponse.json({
      success: true,
      selecthealth_id: selectHealthId,
      mappings,
      expected_mappings: expected,
      note: 'Intake should map to SelectHealth Medicaid service, not generic insurance service'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Admin API endpoint to create service_instances for SelectHealth
// POST /api/admin/selecthealth/create-service-instances

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔧 Creating service_instances for SelectHealth...')

    const selectHealthId = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'
    const effectiveDate = '2025-10-13' // Match contract effective date

    const services = [
      {
        id: 'f0a05d4c-188a-4f1b-9600-54d6c27a3f62',
        name: 'Intake',
        intakeqId: '137bcec9-6d59-4cd8-910f-a1d9c0616319'
      },
      {
        id: '4b6e81ed-e30e-4127-ba71-21aa9fac8cd1',
        name: 'Follow-up (Short)',
        intakeqId: '436ebccd-7e5b-402d-9f13-4c5733e3af8c'
      },
      {
        id: 'a6cdf789-41f7-484d-a948-272547eb566e',
        name: 'Follow-up (Extended)',
        intakeqId: 'f0490d0a-992f-4f14-836f-0e41e11be14d'
      }
    ]

    const created: any[] = []
    const skipped: any[] = []

    for (const service of services) {
      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from('service_instances')
        .select('id')
        .eq('service_id', service.id)
        .eq('payer_id', selectHealthId)
        .maybeSingle()

      if (existing) {
        console.log(`⏭️  ${service.name} service_instance already exists: ${existing.id}`)
        skipped.push({ service: service.name, id: existing.id, reason: 'already exists' })
        continue
      }

      // Create new service_instance
      const { data: instance, error: instanceError } = await supabaseAdmin
        .from('service_instances')
        .insert({
          service_id: service.id,
          payer_id: selectHealthId,
          location: 'Telehealth',
          pos_code: '10',
          effective_date: effectiveDate,
          housing_status: 'Housed',
          active: true
        })
        .select()
        .single()

      if (instanceError) {
        console.error(`❌ Failed to create ${service.name} instance:`, instanceError)
        return NextResponse.json(
          { success: false, error: `Failed to create ${service.name} instance: ${instanceError.message}` },
          { status: 500 }
        )
      }

      console.log(`✅ Created ${service.name} service_instance: ${instance.id}`)
      created.push({ service: service.name, id: instance.id })

      // Create IntakeQ integration mapping
      const { error: integrationError } = await supabaseAdmin
        .from('service_instance_integrations')
        .insert({
          service_instance_id: instance.id,
          system: 'intakeq',
          external_id: service.intakeqId
        })

      if (integrationError) {
        console.error(`⚠️  Failed to create IntakeQ mapping for ${service.name}:`, integrationError)
      } else {
        console.log(`✅ Created IntakeQ mapping for ${service.name}`)
      }
    }

    // Fetch and return all SelectHealth service_instances
    const { data: allInstances, error: fetchError } = await supabaseAdmin
      .from('service_instances')
      .select(`
        id,
        service_id,
        payer_id,
        location,
        pos_code,
        effective_date,
        active,
        created_at,
        service:services!service_instances_service_id_fkey(id, name, description)
      `)
      .eq('payer_id', selectHealthId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Failed to fetch service_instances:', fetchError)
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created.length} service_instances, skipped ${skipped.length}`,
      created,
      skipped,
      all_selecthealth_instances: allInstances || []
    })

  } catch (error: any) {
    console.error('❌ Error creating service_instances:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check current state
export async function GET() {
  try {
    const selectHealthId = 'd37d3938-b48d-4bdf-b500-bf5413157ef4'

    const { data: instances, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        id,
        service_id,
        payer_id,
        location,
        pos_code,
        effective_date,
        active,
        created_at,
        service:services!service_instances_service_id_fkey(id, name, description)
      `)
      .eq('payer_id', selectHealthId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: instances?.length || 0,
      instances
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

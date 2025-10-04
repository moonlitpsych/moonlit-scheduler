import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { provider_id, intakeq_service_id, intakeq_location_id } = await request.json()

    if (!provider_id) {
      return NextResponse.json(
        { error: 'provider_id is required' },
        { status: 400 }
      )
    }

    const updates: any = {}
    if (intakeq_service_id) updates.intakeq_service_id = intakeq_service_id
    if (intakeq_location_id) updates.intakeq_location_id = intakeq_location_id

    const { data, error } = await supabase
      .from('providers')
      .update(updates)
      .eq('id', provider_id)
      .select('first_name, last_name, intakeq_service_id, intakeq_location_id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${data.first_name} ${data.last_name}`,
      provider: data
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to show current status
export async function GET() {
  try {
    const { data: providers, error } = await supabase
      .from('providers')
      .select('id, first_name, last_name, is_bookable, intakeq_practitioner_id, intakeq_service_id, intakeq_location_id')
      .eq('is_bookable', true)
      .order('first_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summary = providers?.map(p => ({
      name: `${p.first_name} ${p.last_name}`,
      practitioner_id: p.intakeq_practitioner_id || '❌ Missing',
      service_id: p.intakeq_service_id || '❌ Missing',
      location_id: p.intakeq_location_id || '❌ Missing',
      ready_for_intakeq: !!(p.intakeq_practitioner_id && p.intakeq_service_id && p.intakeq_location_id)
    }))

    return NextResponse.json({
      success: true,
      providers: summary,
      instructions: {
        message: 'To enable IntakeQ appointment creation, you need to add service_id and location_id for each provider',
        how_to_find: 'Log into IntakeQ dashboard → Settings → Services and Locations',
        update_endpoint: 'POST /api/admin/update-provider-intakeq-ids',
        payload_example: {
          provider_id: 'uuid-here',
          intakeq_service_id: 'service-id-from-intakeq',
          intakeq_location_id: 'location-id-from-intakeq'
        }
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

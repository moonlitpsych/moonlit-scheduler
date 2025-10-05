import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const INTAKEQ_SERVICE_ID = '137bcec9-6d59-4cd8-910f-a1d9c0616319' // New Patient Visit (insurance — UT)
const INTAKEQ_LOCATION_ID = '4' // Insurance — UT

export async function POST() {
  try {
    // Get all bookable providers
    const { data: providers, error: fetchError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, is_bookable')
      .eq('is_bookable', true)

    if (fetchError) throw fetchError

    console.log(`Found ${providers.length} bookable providers`)

    // Update each provider with IntakeQ Service and Location IDs
    const updates = await Promise.all(
      providers.map(async (provider) => {
        const { error } = await supabase
          .from('providers')
          .update({
            intakeq_service_id: INTAKEQ_SERVICE_ID,
            intakeq_location_id: INTAKEQ_LOCATION_ID
          })
          .eq('id', provider.id)

        return {
          provider: `${provider.first_name} ${provider.last_name}`,
          success: !error,
          error: error?.message
        }
      })
    )

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.filter(u => u.success).length} providers`,
      updates,
      config: {
        service_id: INTAKEQ_SERVICE_ID,
        service_name: 'New Patient Visit (insurance — UT)',
        location_id: INTAKEQ_LOCATION_ID,
        location_name: 'Insurance — UT'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current status
    const { data: providers, error } = await supabase
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, intakeq_service_id, intakeq_location_id, is_bookable')
      .eq('is_bookable', true)

    if (error) throw error

    return NextResponse.json({
      success: true,
      providers: providers.map(p => ({
        name: `${p.first_name} ${p.last_name}`,
        has_practitioner_id: !!p.intakeq_practitioner_id,
        has_service_id: !!p.intakeq_service_id,
        has_location_id: !!p.intakeq_location_id,
        ready_for_intakeq: !!p.intakeq_practitioner_id && !!p.intakeq_service_id && !!p.intakeq_location_id
      }))
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

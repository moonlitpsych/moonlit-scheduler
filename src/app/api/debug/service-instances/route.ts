import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    const { data: serviceInstances, error } = await supabase
      .from('service_instances')
      .select(`
        id,
        service_id,
        payer_id,
        location_type,
        services (
          name,
          description
        ),
        payers (
          name,
          is_medicaid
        )
      `)
      .in('id', [
        '12191f44-a09c-426f-8e22-0c5b8e57b3b7',
        '1a659f8e-249a-4690-86e7-359c6c381bc0'
      ])

    if (error) throw error

    return NextResponse.json({
      success: true,
      serviceInstances
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const payerId = 'b9e556b7-1070-47b8-8467-ef1ee5c68e4e' // Regence BCBS

    // Check service instances for this payer
    const { data: instances, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        *,
        services (
          id,
          name,
          duration_minutes
        )
      `)
      .eq('payer_id', payerId)

    // Also check if there are any service instances at all
    const { data: allInstances, error: allError } = await supabaseAdmin
      .from('service_instances')
      .select(`
        *,
        services (name),
        payers (name)
      `)
      .limit(10)

    return NextResponse.json({
      success: true,
      regenceBCBS: {
        count: instances?.length || 0,
        data: instances,
        error: error?.message
      },
      sampleInstances: {
        count: allInstances?.length || 0,
        data: allInstances,
        error: allError?.message
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

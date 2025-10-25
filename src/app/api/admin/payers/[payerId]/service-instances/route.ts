// src/app/api/admin/payers/[payerId]/service-instances/route.ts
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const { payerId } = await params

    if (!payerId || payerId === 'new') {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Fetch service instances for this payer
    const { data: instances, error } = await supabaseAdmin
      .from('service_instances')
      .select(`
        id,
        service_id,
        payer_id,
        location,
        pos_code,
        active,
        services!inner (
          id,
          name,
          duration_minutes,
          description
        )
      `)
      .eq('payer_id', payerId)
      .order('location', { ascending: true })

    if (error) {
      console.error('❌ Error fetching service instances:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: instances || []
    })

  } catch (error: any) {
    console.error('❌ Error in service instances GET:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

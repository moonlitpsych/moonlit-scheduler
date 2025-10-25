// src/app/api/admin/services/route.ts
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Fetch all services
    const { data: services, error } = await supabaseAdmin
      .from('services')
      .select('id, name, duration_minutes, description')
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching services:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: services || []
    })

  } catch (error: any) {
    console.error('❌ Error in services GET:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Admin API endpoint for fetching ALL providers (not just bookable ones)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Note: This endpoint is intentionally open for admin dashboard use
    // If you need to add auth, implement it here

    console.log('🔍 Admin fetching ALL providers...')

    // Fetch ALL providers (no filters) for admin use
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, is_active, is_bookable, role, title, provider_type')
      .order('last_name')

    if (error) {
      console.error('❌ Error fetching providers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${providers?.length || 0} providers`)

    return NextResponse.json({
      success: true,
      data: providers || [],
      total: providers?.length || 0
    })

  } catch (error: any) {
    console.error('❌ Error in admin providers API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch providers',
        details: error.message
      },
      { status: 500 }
    )
  }
}

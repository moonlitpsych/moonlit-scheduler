// API to fetch roles from the database
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching roles from database...')

    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('name')

    if (error) {
      console.error('❌ Error fetching roles:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch roles', details: error },
        { status: 500 }
      )
    }

    console.log(`✅ Found ${roles?.length || 0} roles`)

    return NextResponse.json({
      success: true,
      data: roles || []
    })

  } catch (error: any) {
    console.error('❌ Error in roles API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch roles',
        details: error.message
      },
      { status: 500 }
    )
  }
}

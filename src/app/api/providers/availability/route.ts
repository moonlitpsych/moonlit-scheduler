import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore })
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    const { providerId, schedule } = await request.json()

    if (!providerId || !schedule) {
      return NextResponse.json({ 
        success: false, 
        error: 'Provider ID and schedule are required' 
      }, { status: 400 })
    }

    console.log('🔧 Provider availability API: Saving schedule for provider:', providerId)
    console.log('🔧 User:', user.email)

    // Verify user has access to this provider
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .eq('auth_user_id', user.id)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'Provider not found or access denied' 
      }, { status: 403 })
    }

    // Delete existing availability for this provider
    const { error: deleteError } = await supabaseAdmin
      .from('provider_availability')
      .delete()
      .eq('provider_id', providerId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to delete existing availability: ${deleteError.message}` 
      }, { status: 500 })
    }

    // Prepare new availability blocks
    const newBlocks = []
    Object.values(schedule).forEach((daySchedule: any) => {
      if (daySchedule.is_available && daySchedule.time_blocks.length > 0) {
        daySchedule.time_blocks.forEach((block: any) => {
          if (block.start_time && block.end_time) {
            newBlocks.push({
              provider_id: providerId,
              day_of_week: daySchedule.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time,
              is_recurring: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        })
      }
    })

    console.log('🔧 New blocks to insert:', newBlocks.length)

    // Insert new blocks using admin client
    if (newBlocks.length > 0) {
      console.log('🔧 Attempting to insert blocks:', JSON.stringify(newBlocks, null, 2))
      
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('provider_availability')
        .insert(newBlocks)
        .select()

      console.log('🔧 Insert operation result:', { insertData, insertError })

      if (insertError) {
        console.error('❌ Insert error:', insertError)
        return NextResponse.json({ 
          success: false, 
          error: `Failed to insert availability: ${insertError.message}` 
        }, { status: 500 })
      }

      // Verify insertion was successful
      if (!insertData || insertData.length === 0) {
        console.error('❌ No data returned from insert operation - possible RLS issue')
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to insert availability - no data returned' 
        }, { status: 500 })
      }

      console.log(`✅ Successfully inserted ${insertData.length} availability records`)
    }

    console.log('✅ Schedule saved successfully')

    return NextResponse.json({
      success: true,
      message: 'Schedule saved successfully',
      blocksCreated: newBlocks.length
    })

  } catch (error: any) {
    console.error('❌ Error in provider availability API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore })
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }

    const url = new URL(request.url)
    const providerId = url.searchParams.get('providerId')

    if (!providerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Provider ID is required' 
      }, { status: 400 })
    }

    // Verify user has access to this provider
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .eq('auth_user_id', user.id)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'Provider not found or access denied' 
      }, { status: 403 })
    }

    // Get availability for this provider
    console.log('🔧 Loading availability for provider:', providerId)
    const { data: availability, error: availError } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', providerId)
      .order('day_of_week')

    console.log('🔧 GET availability result:', { availability, availError })

    if (availError) {
      console.error('❌ Availability query error:', availError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to load availability: ${availError.message}` 
      }, { status: 500 })
    }

    const response = {
      success: true,
      availability: availability || [],
      availabilityCount: availability?.length || 0,
      providerId: providerId
    }
    
    console.log('🔧 GET API response:', response)
    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Error in provider availability GET API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
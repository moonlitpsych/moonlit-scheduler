import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

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

    // Check if user is admin
    const isAdmin = isAdminEmail(user.email || '')

    // Load provider for verification and logging
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Provider not found'
      }, { status: 404 })
    }

    // Verify access: must be the provider themselves OR an admin
    if (!isAdmin && provider.auth_user_id !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 })
    }

    console.log(`🔧 ${isAdmin ? 'Admin' : 'Provider'} updating schedule for: ${provider.first_name} ${provider.last_name}`)

    // Load existing availability for audit logging
    const { data: oldAvailability } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', providerId)
      .order('day_of_week')

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
              timezone: 'America/Denver',
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

    // Log admin action if this was an admin edit
    if (isAdmin) {
      try {
        await supabaseAdmin
          .from('admin_action_logs')
          .insert({
            admin_email: user.email,
            provider_id: providerId,
            action_type: 'availability_update',
            description: `Updated availability schedule for ${provider.first_name} ${provider.last_name}`,
            table_name: 'provider_availability',
            changes: {
              before: oldAvailability || [],
              after: newBlocks,
              blocksDeleted: oldAvailability?.length || 0,
              blocksCreated: newBlocks.length
            }
          })
        console.log('✅ Audit log created for admin action')
      } catch (logError) {
        console.error('⚠️ Failed to create audit log (non-blocking):', logError)
        // Don't fail the request if logging fails
      }
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

    // Check if user is admin
    const isAdmin = isAdminEmail(user.email || '')

    // Load provider for verification
    const { data: provider, error: providerError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Provider not found'
      }, { status: 404 })
    }

    // Verify access: must be the provider themselves OR an admin
    if (!isAdmin && provider.auth_user_id !== user.id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
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
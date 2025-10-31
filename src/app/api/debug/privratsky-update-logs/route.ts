import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Find Dr. Privratsky
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, auth_user_id')
      .ilike('last_name', '%privratsky%')
      .single()

    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'Provider not found'
      }, { status: 404 })
    }

    // Check admin action logs for availability updates
    const { data: adminLogs } = await supabaseAdmin
      .from('admin_action_logs')
      .select('*')
      .eq('provider_id', provider.id)
      .eq('action_type', 'availability_update')
      .order('created_at', { ascending: false })
      .limit(10)

    // Check his current availability
    const { data: currentAvailability } = await supabaseAdmin
      .from('provider_availability')
      .select('*')
      .eq('provider_id', provider.id)
      .order('day_of_week')

    // Check if he has an auth account
    let authInfo = null
    if (provider.auth_user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        provider.auth_user_id
      )
      authInfo = {
        user_id: authUser?.user?.id,
        email: authUser?.user?.email,
        last_sign_in: authUser?.user?.last_sign_in_at
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          name: `${provider.first_name} ${provider.last_name}`,
          auth_user_id: provider.auth_user_id,
          has_auth_account: !!provider.auth_user_id
        },
        auth_info: authInfo,
        admin_logs: {
          count: adminLogs?.length || 0,
          recent: adminLogs?.map(log => ({
            admin_email: log.admin_email,
            description: log.description,
            created_at: log.created_at,
            changes: log.changes
          }))
        },
        current_availability: currentAvailability?.map(slot => ({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          created_at: slot.created_at,
          updated_at: slot.updated_at
        }))
      }
    })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

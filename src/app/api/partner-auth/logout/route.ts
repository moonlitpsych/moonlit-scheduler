// Partner User Authentication - Logout
import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Get current session to log the logout
    const cookieStore = cookies()
    const supabaseServer = createServerComponentClient({ cookies: () => cookieStore })
    
    const { data: { session } } = await supabaseServer.auth.getSession()
    
    let partnerUserId: string | null = null
    
    if (session) {
      // Get partner user info before logout for audit logging
      const { data: partnerUser } = await supabaseAdmin
        .from('partner_users')
        .select('id, email, organization_id')
        .eq('auth_user_id', session.user.id)
        .single()
      
      if (partnerUser) {
        partnerUserId = partnerUser.id
        
        // Log logout for audit
        await supabaseAdmin
          .from('scheduler_audit_logs')
          .insert({
            user_identifier: partnerUser.id,
            action: 'partner_logout',
            resource_type: 'partner_user',
            resource_id: partnerUser.id,
            details: {
              organization_id: partnerUser.organization_id,
              logout_method: 'explicit'
            }
          })
      }
    }

    // Sign out from Supabase
    const { error: signOutError } = await supabaseServer.auth.signOut()

    if (signOutError) {
      console.error('❌ Logout error:', signOutError.message)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Logout failed' 
        },
        { status: 500 }
      )
    }

    console.log('✅ Partner user logged out:', { partner_user_id: partnerUserId })

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error: any) {
    console.error('❌ Logout error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Logout failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
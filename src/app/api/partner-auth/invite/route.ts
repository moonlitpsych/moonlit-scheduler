// Partner User Authentication - Send Invitation
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { emailService } from '@/lib/services/emailService'
import { InvitePartnerUserRequest } from '@/types/partner-types'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body: InvitePartnerUserRequest = await request.json()
    const { organization_id, email, role, first_name, last_name, message } = body

    if (!organization_id || !email || !role) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization ID, email, and role are required' 
        },
        { status: 400 }
      )
    }

    // Validate role
    if (!['partner_admin', 'partner_case_manager'].includes(role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid role. Must be partner_admin or partner_case_manager' 
        },
        { status: 400 }
      )
    }

    console.log('📧 Sending partner user invitation:', { organization_id, email, role })

    // 1. Check if organization exists and is active
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organization_id)
      .eq('status', 'active')
      .single()

    if (orgError || !organization) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Organization not found or inactive' 
        },
        { status: 404 }
      )
    }

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('partner_users')
      .select('id, status, email')
      .eq('email', email.toLowerCase())
      .eq('organization_id', organization_id)
      .single()

    if (existingUser) {
      if (existingUser.status === 'active') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'User already exists and is active in this organization' 
          },
          { status: 409 }
        )
      } else if (existingUser.status === 'pending_invitation') {
        // Update existing pending invitation
        const invitationToken = crypto.randomBytes(32).toString('hex')
        const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

        await supabaseAdmin
          .from('partner_users')
          .update({
            invitation_token: invitationToken,
            invitation_expires: invitationExpires.toISOString(),
            role: role,
            first_name: first_name || null,
            last_name: last_name || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)

        // Send new invitation email
        await sendInvitationEmail(
          email, 
          organization.name, 
          invitationToken, 
          role, 
          first_name, 
          message
        )

        return NextResponse.json({
          success: true,
          message: 'New invitation sent to existing pending user',
          data: { user_id: existingUser.id }
        })
      }
    }

    // 3. Create new partner user record with pending status
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const { data: newUser, error: userError } = await supabaseAdmin
      .from('partner_users')
      .insert({
        organization_id,
        email: email.toLowerCase(),
        first_name: first_name || null,
        last_name: last_name || null,
        role,
        status: 'pending_invitation',
        email_verified: false,
        invitation_token: invitationToken,
        invitation_expires: invitationExpires.toISOString(),
        timezone: 'America/Denver' // Default timezone
      })
      .select()
      .single()

    if (userError || !newUser) {
      console.error('❌ Failed to create partner user:', userError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create user record' 
        },
        { status: 500 }
      )
    }

    // 4. Send invitation email
    try {
      await sendInvitationEmail(
        email, 
        organization.name, 
        invitationToken, 
        role, 
        first_name, 
        message
      )
    } catch (emailError: any) {
      console.error('⚠️ Failed to send invitation email:', emailError.message)
      // Don't fail the request, but log the issue
    }

    // 5. Log invitation for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: newUser.id,
        action: 'partner_user_invited',
        resource_type: 'partner_user',
        resource_id: newUser.id,
        details: {
          organization_id,
          organization_name: organization.name,
          role,
          invited_email: email,
          invitation_expires: invitationExpires.toISOString()
        }
      })

    console.log('✅ Partner user invitation created:', {
      user_id: newUser.id,
      email,
      organization: organization.name,
      role
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        user_id: newUser.id,
        invitation_expires: invitationExpires.toISOString()
      }
    })

  } catch (error: any) {
    console.error('❌ Partner invitation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send invitation',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// Helper function to send invitation email
async function sendInvitationEmail(
  email: string,
  organizationName: string,
  invitationToken: string,
  role: string,
  firstName?: string,
  customMessage?: string
) {
  const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/partner-auth/accept-invitation?token=${invitationToken}`
  
  const roleDisplayName = role === 'partner_admin' ? 'Partner Admin' : 'Case Manager'
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #091747;">Welcome to Moonlit Scheduler</h2>
      
      <p>Hello${firstName ? ` ${firstName}` : ''},</p>
      
      <p>You've been invited to join <strong>${organizationName}</strong> as a ${roleDisplayName} on the Moonlit Scheduler platform.</p>
      
      ${customMessage ? `<div style="background-color: #FEF8F1; padding: 15px; border-left: 4px solid #BF9C73; margin: 20px 0;">
        <p style="margin: 0;"><em>"${customMessage}"</em></p>
      </div>` : ''}
      
      <p>As a ${roleDisplayName}, you'll be able to:</p>
      <ul>
        <li>View and manage patient appointments</li>
        <li>Request appointment changes and cancellations</li>
        <li>Access patient information (with proper ROI consent)</li>
        ${role === 'partner_admin' ? '<li>Invite and manage other team members</li>' : ''}
        <li>Receive notifications about appointment updates</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}" 
           style="background-color: #BF9C73; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Accept Invitation & Set Password
        </a>
      </div>
      
      <p><small>This invitation expires in 7 days. If you have any questions, please contact us at hello@trymoonlit.com.</small></p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">
        Moonlit Scheduler - Streamlining mental health care coordination
      </p>
    </div>
  `

  // Use existing email service (fallback to console if not configured)
  try {
    await emailService.sendEmail({
      to: email,
      subject: `Invitation to join ${organizationName} on Moonlit Scheduler`,
      html: emailHtml
    })
  } catch (error) {
    console.log('📧 Email would be sent to:', email)
    console.log('📧 Invitation URL:', invitationUrl)
    console.log('📧 Email content:', emailHtml)
    throw error
  }
}
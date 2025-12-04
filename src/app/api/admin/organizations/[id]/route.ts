// Admin Organizations API - Single Organization
// GET /api/admin/organizations/[id] - Get single organization
// PATCH /api/admin/organizations/[id] - Update organization
// DELETE /api/admin/organizations/[id] - Soft delete organization

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Admin verification error:', error)
    return { authorized: false, user: null }
  }
}

// GET - Get single organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    const { data: organization, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get user count
    const { count: userCount } = await supabaseAdmin
      .from('partner_users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      data: {
        ...organization,
        user_count: userCount || 0
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching organization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

// PATCH - Update organization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    console.log('✏️ Admin updating organization:', id)

    // Check organization exists
    const { data: existingOrg, error: fetchError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', id)
      .single()

    if (fetchError || !existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    // If slug is being changed, check uniqueness
    if (body.slug && body.slug !== existingOrg.slug) {
      const { data: slugConflict } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', id)
        .single()

      if (slugConflict) {
        return NextResponse.json(
          { success: false, error: 'Organization slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build update object (only include fields that are provided)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    const allowedFields = [
      'name', 'slug', 'type', 'status',
      'primary_contact_name', 'primary_contact_email', 'primary_contact_phone',
      'address_line_1', 'address_line_2', 'city', 'state', 'zip_code',
      'tax_id', 'license_number', 'accreditation_details',
      'allowed_domains', 'settings'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Update organization
    const { data: organization, error } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating organization:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update organization' },
        { status: 500 }
      )
    }

    // Log admin action
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'organization_updated',
        resource_type: 'organization',
        resource_id: id,
        performed_by: user?.id || 'admin',
        details: {
          organization_name: organization.name,
          updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
          admin_email: user?.email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Organization updated successfully:', id)

    return NextResponse.json({
      success: true,
      data: organization,
      message: 'Organization updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin update organization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update organization', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete organization (set status to inactive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    console.log('🗑️ Admin soft-deleting organization:', id)

    // Check organization exists
    const { data: existingOrg, error: fetchError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, status')
      .eq('id', id)
      .single()

    if (fetchError || !existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    if (existingOrg.status === 'inactive') {
      return NextResponse.json(
        { success: false, error: 'Organization is already inactive' },
        { status: 400 }
      )
    }

    // Count active team members
    const { count: activeUserCount } = await supabaseAdmin
      .from('partner_users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('is_active', true)

    // Soft delete: set organization status to inactive
    const { error: orgError } = await supabaseAdmin
      .from('organizations')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (orgError) {
      console.error('❌ Error deactivating organization:', orgError)
      return NextResponse.json(
        { success: false, error: 'Failed to deactivate organization' },
        { status: 500 }
      )
    }

    // Deactivate all team members
    let deactivatedUsers = 0
    if (activeUserCount && activeUserCount > 0) {
      const { error: usersError } = await supabaseAdmin
        .from('partner_users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', id)
        .eq('is_active', true)

      if (usersError) {
        console.error('⚠️ Error deactivating team members:', usersError)
        // Don't fail the whole operation, just log it
      } else {
        deactivatedUsers = activeUserCount
      }
    }

    // Log admin action
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'organization_deactivated',
        resource_type: 'organization',
        resource_id: id,
        performed_by: user?.id || 'admin',
        details: {
          organization_name: existingOrg.name,
          deactivated_users: deactivatedUsers,
          admin_email: user?.email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      })

    console.log('✅ Organization deactivated successfully:', id, `(${deactivatedUsers} users affected)`)

    return NextResponse.json({
      success: true,
      message: 'Organization deactivated successfully',
      affected_users: deactivatedUsers
    })

  } catch (error: any) {
    console.error('❌ Admin delete organization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate organization', details: error.message },
      { status: 500 }
    )
  }
}

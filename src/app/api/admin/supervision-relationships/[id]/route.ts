// Individual Supervision Relationship API
// PUT /api/admin/supervision-relationships/[id] - Update supervision relationship
// DELETE /api/admin/supervision-relationships/[id] - Delete supervision relationship

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

async function verifyAdminAccess() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
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

async function createAuditLog(action: string, resourceType: string, resourceId: string, userId: string, changes: any, request: NextRequest) {
  try {
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        performed_by: userId,
        changes,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

function calculateDiff(before: any, after: any): Array<{ field: string; old_value: any; new_value: any }> {
  const diff = []
  const fieldsToCheck = [
    'designation', 'effective_date', 'expiration_date', 'modality_constraints', 
    'concurrency_cap', 'status', 'notes'
  ]
  
  for (const field of fieldsToCheck) {
    const oldValue = before[field]
    const newValue = after[field]
    
    // Handle array comparison for modality constraints
    if (field === 'modality_constraints') {
      const oldArray = Array.isArray(oldValue) ? oldValue.sort() : []
      const newArray = Array.isArray(newValue) ? newValue.sort() : []
      if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
        diff.push({ field, old_value: oldValue, new_value: newValue })
      }
    } else if (oldValue !== newValue) {
      diff.push({ field, old_value: oldValue, new_value: newValue })
    }
  }
  
  return diff
}

// PUT - Update supervision relationship
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const relationshipId = params.id
    const body = await request.json()

    // Validate required fields
    if (!body.effective_date) {
      return NextResponse.json(
        { success: false, error: 'effective_date is required' },
        { status: 400 }
      )
    }

    // Validate designation
    if (!['primary', 'secondary'].includes(body.designation)) {
      return NextResponse.json(
        { success: false, error: 'designation must be primary or secondary' },
        { status: 400 }
      )
    }

    // Validate concurrency cap
    if (body.concurrency_cap && (body.concurrency_cap < 1 || body.concurrency_cap > 100)) {
      return NextResponse.json(
        { success: false, error: 'concurrency_cap must be between 1 and 100' },
        { status: 400 }
      )
    }

    console.log('📝 Admin updating supervision relationship:', relationshipId)

    // Get existing relationship for audit and validation
    const { data: existingRelationship, error: fetchError } = await supabaseAdmin
      .from('supervision_relationships')
      .select('*')
      .eq('id', relationshipId)
      .single()

    if (fetchError || !existingRelationship) {
      return NextResponse.json(
        { success: false, error: 'Supervision relationship not found' },
        { status: 404 }
      )
    }

    // Check for overlapping primary relationships if changing to primary
    if (body.designation === 'primary' && existingRelationship.designation !== 'primary') {
      const { data: existingPrimary } = await supabaseAdmin
        .from('supervision_relationships')
        .select('id, attending_provider_id, providers!supervision_relationships_attending_provider_id_fkey(first_name, last_name)')
        .eq('resident_provider_id', existingRelationship.resident_provider_id)
        .eq('designation', 'primary')
        .eq('status', 'active')
        .neq('id', relationshipId)
        .single()

      if (existingPrimary) {
        const attendingName = existingPrimary.providers ? 
          `${existingPrimary.providers.first_name} ${existingPrimary.providers.last_name}` : 
          'Unknown'
        return NextResponse.json(
          { success: false, error: `Resident already has a primary supervising physician: ${attendingName}` },
          { status: 400 }
        )
      }
    }

    // Update supervision relationship
    const { data: updatedRelationship, error } = await supabaseAdmin
      .from('supervision_relationships')
      .update({
        designation: body.designation,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date || null,
        modality_constraints: body.modality_constraints || [],
        concurrency_cap: body.concurrency_cap || null,
        status: body.status || 'active',
        notes: body.notes || null,
        updated_by: user?.id || 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', relationshipId)
      .select(`
        *,
        resident:providers!supervision_relationships_resident_provider_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        attending:providers!supervision_relationships_attending_provider_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('❌ Error updating supervision relationship:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update supervision relationship' },
        { status: 500 }
      )
    }

    // Create audit log with diff
    const diff = calculateDiff(existingRelationship, updatedRelationship)
    await createAuditLog(
      'supervision_relationship_updated',
      'supervision_relationship',
      relationshipId,
      user?.id || 'admin',
      {
        before: existingRelationship,
        after: updatedRelationship,
        diff
      },
      request
    )

    console.log('✅ Supervision relationship updated successfully:', relationshipId)

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRelationship,
        resident_name: updatedRelationship.resident ? 
          `${updatedRelationship.resident.first_name} ${updatedRelationship.resident.last_name}` : 
          'Unknown Resident',
        attending_name: updatedRelationship.attending ? 
          `${updatedRelationship.attending.first_name} ${updatedRelationship.attending.last_name}` : 
          'Unknown Attending',
        modality_display: updatedRelationship.modality_constraints && updatedRelationship.modality_constraints.length > 0 ?
          updatedRelationship.modality_constraints.join(', ') : 
          'All modalities'
      },
      message: 'Supervision relationship updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin update supervision relationship error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update supervision relationship',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete supervision relationship
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const relationshipId = params.id

    console.log('🗑️ Admin deleting supervision relationship:', relationshipId)

    // Get existing relationship for audit
    const { data: existingRelationship, error: fetchError } = await supabaseAdmin
      .from('supervision_relationships')
      .select(`
        *,
        resident:providers!supervision_relationships_resident_provider_id_fkey (
          id,
          first_name,
          last_name
        ),
        attending:providers!supervision_relationships_attending_provider_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', relationshipId)
      .single()

    if (fetchError || !existingRelationship) {
      return NextResponse.json(
        { success: false, error: 'Supervision relationship not found' },
        { status: 404 }
      )
    }

    // Delete supervision relationship
    const { error } = await supabaseAdmin
      .from('supervision_relationships')
      .delete()
      .eq('id', relationshipId)

    if (error) {
      console.error('❌ Error deleting supervision relationship:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete supervision relationship' },
        { status: 500 }
      )
    }

    // Create audit log
    await createAuditLog(
      'supervision_relationship_deleted',
      'supervision_relationship',
      relationshipId,
      user?.id || 'admin',
      {
        before: existingRelationship,
        after: null,
        diff: []
      },
      request
    )

    const residentName = existingRelationship.resident ? 
      `${existingRelationship.resident.first_name} ${existingRelationship.resident.last_name}` : 
      'Unknown Resident'
    const attendingName = existingRelationship.attending ? 
      `${existingRelationship.attending.first_name} ${existingRelationship.attending.last_name}` : 
      'Unknown Attending'

    console.log('✅ Supervision relationship deleted successfully:', relationshipId)

    return NextResponse.json({
      success: true,
      message: `Supervision relationship between ${residentName} and ${attendingName} deleted successfully`
    })

  } catch (error: any) {
    console.error('❌ Admin delete supervision relationship error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete supervision relationship',
        details: error.message
      },
      { status: 500 }
    )
  }
}
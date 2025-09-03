// Individual Partner CRM API - Get, Update, Delete
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Get single partner by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner ID is required' 
        },
        { status: 400 }
      )
    }

    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select(`*`)
      .eq('id', id)
      .single()

    if (error || !partner) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner not found' 
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: partner
    })

  } catch (error: any) {
    console.error('❌ Partner fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch partner',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// PUT - Update partner
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner ID is required' 
        },
        { status: 400 }
      )
    }

    // Get current partner for audit logging
    const { data: currentPartner, error: fetchError } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentPartner) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner not found' 
        },
        { status: 404 }
      )
    }

    // Validate fields if provided
    if (body.stage) {
      const validStages = ['lead', 'qualified', 'contract_sent', 'live', 'dormant']
      if (!validStages.includes(body.stage)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid stage. Must be one of: ${validStages.join(', ')}` 
          },
          { status: 400 }
        )
      }
    }

    if (body.status) {
      const validStatuses = ['prospect', 'active', 'paused', 'terminated']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
          },
          { status: 400 }
        )
      }
    }

    // If organization_id provided, verify it exists
    if (body.organization_id) {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .eq('id', body.organization_id)
        .single()

      if (orgError || !org) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Organization not found' 
          },
          { status: 404 }
        )
      }
    }

    console.log('📝 Updating partner:', { id, updates: Object.keys(body) })

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    // Only update provided fields
    const allowedFields = [
      'name', 'organization_id', 'contact_email', 'contact_phone', 
      'contact_person', 'title', 'stage', 'status', 'source',
      'specialties', 'insurance_types', 'monthly_referral_capacity',
      'notes', 'website', 'linkedin_url', 'first_contact_date',
      'last_contact_date', 'contract_signed_date', 'go_live_date',
      'assigned_to'
    ]

    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        if (field === 'contact_email' && body[field]) {
          updateData[field] = body[field].toLowerCase()
        } else if (field === 'name' && body[field]) {
          updateData[field] = body[field].trim()
        } else {
          updateData[field] = body[field]
        }
      }
    }

    // Update last_contact_date if not explicitly set
    if (!body.last_contact_date) {
      updateData.last_contact_date = new Date().toISOString().split('T')[0]
    }

    const { data: updatedPartner, error: updateError } = await supabaseAdmin
      .from('partners')
      .update(updateData)
      .eq('id', id)
      .select(`*`)
      .single()

    if (updateError) {
      console.error('❌ Failed to update partner:', updateError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update partner',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    // Log update for audit
    const changes = Object.keys(body).reduce((acc, key) => {
      if (currentPartner[key] !== body[key]) {
        acc[key] = {
          from: currentPartner[key],
          to: body[key]
        }
      }
      return acc
    }, {} as Record<string, any>)

    if (Object.keys(changes).length > 0) {
      await supabaseAdmin
        .from('scheduler_audit_logs')
        .insert({
          action: 'partner_updated',
          resource_type: 'partner',
          resource_id: id,
          details: {
            partner_name: updatedPartner.name,
            changes
          }
        })
    }

    console.log('✅ Partner updated successfully:', {
      id: updatedPartner.id,
      name: updatedPartner.name,
      changes: Object.keys(changes)
    })

    return NextResponse.json({
      success: true,
      data: updatedPartner,
      message: 'Partner updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Partner update error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update partner',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete partner (soft delete by setting status to terminated)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner ID is required' 
        },
        { status: 400 }
      )
    }

    // Get partner info before deletion
    const { data: partner, error: fetchError } = await supabaseAdmin
      .from('partners')
      .select('name, status, organization_id')
      .eq('id', id)
      .single()

    if (fetchError || !partner) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Partner not found' 
        },
        { status: 404 }
      )
    }

    console.log('🗑️ Soft deleting partner:', { id, name: partner.name })

    // Soft delete by setting status to terminated
    const { error: deleteError } = await supabaseAdmin
      .from('partners')
      .update({
        status: 'terminated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (deleteError) {
      console.error('❌ Failed to delete partner:', deleteError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to delete partner',
          details: deleteError.message
        },
        { status: 500 }
      )
    }

    // Log deletion for audit
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        action: 'partner_deleted',
        resource_type: 'partner',
        resource_id: id,
        details: {
          partner_name: partner.name,
          previous_status: partner.status,
          deletion_method: 'soft_delete'
        }
      })

    console.log('✅ Partner soft deleted successfully:', { id, name: partner.name })

    return NextResponse.json({
      success: true,
      message: 'Partner deleted successfully'
    })

  } catch (error: any) {
    console.error('❌ Partner deletion error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete partner',
        details: error.message
      },
      { status: 500 }
    )
  }
}
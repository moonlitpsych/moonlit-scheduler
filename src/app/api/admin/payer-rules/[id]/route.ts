// Individual Payer Rule API
// PUT /api/admin/payer-rules/[id] - Update payer rule
// DELETE /api/admin/payer-rules/[id] - Delete payer rule

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SupervisionLevel } from '@/types/admin-operations'

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
    'requires_supervision', 'allowed_supervision_levels', 'bill_as_type', 
    'notes', 'effective_date', 'expiration_date', 'product_code'
  ]
  
  for (const field of fieldsToCheck) {
    const oldValue = before[field]
    const newValue = after[field]
    
    // Handle array comparison for supervision levels
    if (field === 'allowed_supervision_levels') {
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

// PUT - Update payer rule
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

    const ruleId = params.id
    const body = await request.json()

    // Validate required fields
    if (!body.bill_as_type || !body.effective_date) {
      return NextResponse.json(
        { success: false, error: 'bill_as_type and effective_date are required' },
        { status: 400 }
      )
    }

    // Validate supervision levels if supervision is required
    if (body.requires_supervision && (!body.allowed_supervision_levels || body.allowed_supervision_levels.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'allowed_supervision_levels is required when supervision is required' },
        { status: 400 }
      )
    }

    // Validate bill_as_type
    if (!['attending', 'resident', 'either'].includes(body.bill_as_type)) {
      return NextResponse.json(
        { success: false, error: 'bill_as_type must be attending, resident, or either' },
        { status: 400 }
      )
    }

    // Validate supervision levels
    const validSupervisionLevels: SupervisionLevel[] = ['sign_off_only', 'first_visit_in_person', 'co_visit_required']
    if (body.allowed_supervision_levels) {
      const invalidLevels = body.allowed_supervision_levels.filter((level: string) => !validSupervisionLevels.includes(level as SupervisionLevel))
      if (invalidLevels.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid supervision levels: ${invalidLevels.join(', ')}` },
          { status: 400 }
        )
      }
    }

    console.log('📝 Admin updating payer rule:', ruleId)

    // Get existing rule for audit
    const { data: existingRule, error: fetchError } = await supabaseAdmin
      .from('payer_rules')
      .select('*')
      .eq('id', ruleId)
      .single()

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { success: false, error: 'Payer rule not found' },
        { status: 404 }
      )
    }

    // Update payer rule
    const { data: updatedRule, error } = await supabaseAdmin
      .from('payer_rules')
      .update({
        requires_supervision: body.requires_supervision || false,
        allowed_supervision_levels: body.allowed_supervision_levels || [],
        bill_as_type: body.bill_as_type,
        notes: body.notes || null,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date || null,
        updated_by: user?.id || 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .select(`
        *,
        payer:payers (
          id,
          name,
          state
        )
      `)
      .single()

    if (error) {
      console.error('❌ Error updating payer rule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update payer rule' },
        { status: 500 }
      )
    }

    // Create audit log with diff
    const diff = calculateDiff(existingRule, updatedRule)
    await createAuditLog(
      'payer_rule_updated',
      'payer_rule',
      ruleId,
      user?.id || 'admin',
      {
        before: existingRule,
        after: updatedRule,
        diff
      },
      request
    )

    console.log('✅ Payer rule updated successfully:', ruleId)

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRule,
        payer_name: updatedRule.payer?.name || 'Unknown Payer',
        payer_state: updatedRule.payer?.state || ''
      },
      message: 'Payer rule updated successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin update payer rule error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update payer rule',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete payer rule
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

    const ruleId = params.id

    console.log('🗑️ Admin deleting payer rule:', ruleId)

    // Get existing rule for audit
    const { data: existingRule, error: fetchError } = await supabaseAdmin
      .from('payer_rules')
      .select(`
        *,
        payer:payers (
          id,
          name,
          state
        )
      `)
      .eq('id', ruleId)
      .single()

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { success: false, error: 'Payer rule not found' },
        { status: 404 }
      )
    }

    // Delete payer rule
    const { error } = await supabaseAdmin
      .from('payer_rules')
      .delete()
      .eq('id', ruleId)

    if (error) {
      console.error('❌ Error deleting payer rule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete payer rule' },
        { status: 500 }
      )
    }

    // Create audit log
    await createAuditLog(
      'payer_rule_deleted',
      'payer_rule',
      ruleId,
      user?.id || 'admin',
      {
        before: existingRule,
        after: null,
        diff: []
      },
      request
    )

    console.log('✅ Payer rule deleted successfully:', ruleId)

    return NextResponse.json({
      success: true,
      message: `Payer rule for ${existingRule.payer?.name} deleted successfully`
    })

  } catch (error: any) {
    console.error('❌ Admin delete payer rule error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete payer rule',
        details: error.message
      },
      { status: 500 }
    )
  }
}
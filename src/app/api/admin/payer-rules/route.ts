// Admin Payer Rules API
// GET /api/admin/payer-rules - List all payer rules with payer details
// POST /api/admin/payer-rules - Create new payer rule with audit logging

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { PayerRule, SupervisionLevel } from '@/types/admin-operations'

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

// GET - List all payer rules
export async function GET(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching payer rules')

    // First check if payer_rules table exists, if not create it
    const { data: tables } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'payer_rules')

    if (!tables || tables.length === 0) {
      // Create payer_rules table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS payer_rules (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          payer_id UUID NOT NULL REFERENCES payers(id),
          product_code TEXT,
          requires_supervision BOOLEAN NOT NULL DEFAULT false,
          allowed_supervision_levels TEXT[] NOT NULL DEFAULT '{}',
          bill_as_type TEXT NOT NULL DEFAULT 'attending' CHECK (bill_as_type IN ('attending', 'resident', 'either')),
          notes TEXT,
          effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
          expiration_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          UNIQUE(payer_id, product_code)
        )
      `
      
      await supabaseAdmin.rpc('exec_sql', { query: createTableQuery })
      
      console.log('✅ Created payer_rules table')
    }

    // Fetch payer rules with payer details and contract counts
    const { data: payerRules, error } = await supabaseAdmin
      .from('payer_rules')
      .select(`
        id,
        payer_id,
        product_code,
        requires_supervision,
        allowed_supervision_levels,
        bill_as_type,
        notes,
        effective_date,
        expiration_date,
        created_at,
        updated_at,
        created_by,
        updated_by,
        payer:payers (
          id,
          name,
          state,
          payer_type
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching payer rules:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payer rules' },
        { status: 500 }
      )
    }

    // Get contract counts for each payer
    const rulesWithCounts = await Promise.all(
      (payerRules || []).map(async (rule) => {
        const { count: contractsCount } = await supabaseAdmin
          .from('provider_payer_networks')
          .select('*', { count: 'exact', head: true })
          .eq('payer_id', rule.payer_id)

        return {
          ...rule,
          payer_name: rule.payer?.name || 'Unknown Payer',
          payer_state: rule.payer?.state || '',
          contracts_count: contractsCount || 0
        }
      })
    )

    console.log(`✅ Found ${payerRules?.length || 0} payer rules`)

    return NextResponse.json({
      success: true,
      data: rulesWithCounts
    })

  } catch (error: any) {
    console.error('❌ Admin payer rules API error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}

// POST - Create new payer rule
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.payer_id || !body.bill_as_type || !body.effective_date) {
      return NextResponse.json(
        { success: false, error: 'payer_id, bill_as_type, and effective_date are required' },
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

    console.log('➕ Admin creating new payer rule for payer:', body.payer_id)

    // Check for existing rule for same payer/product
    const { data: existingRule } = await supabaseAdmin
      .from('payer_rules')
      .select('id')
      .eq('payer_id', body.payer_id)
      .eq('product_code', body.product_code || null)
      .single()

    if (existingRule) {
      return NextResponse.json(
        { success: false, error: 'A rule already exists for this payer and product combination' },
        { status: 400 }
      )
    }

    // Create payer rule
    const { data: payerRule, error } = await supabaseAdmin
      .from('payer_rules')
      .insert({
        payer_id: body.payer_id,
        product_code: body.product_code || null,
        requires_supervision: body.requires_supervision || false,
        allowed_supervision_levels: body.allowed_supervision_levels || [],
        bill_as_type: body.bill_as_type,
        notes: body.notes || null,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date || null,
        created_by: user?.id || 'admin',
        updated_by: user?.id || 'admin'
      })
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
      console.error('❌ Error creating payer rule:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create payer rule' },
        { status: 500 }
      )
    }

    // Create audit log
    await createAuditLog(
      'payer_rule_created',
      'payer_rule',
      payerRule.id,
      user?.id || 'admin',
      {
        before: null,
        after: payerRule,
        diff: []
      },
      request
    )

    console.log('✅ Payer rule created successfully:', payerRule.id)

    return NextResponse.json({
      success: true,
      data: {
        ...payerRule,
        payer_name: payerRule.payer?.name || 'Unknown Payer',
        payer_state: payerRule.payer?.state || '',
        contracts_count: 0
      },
      message: 'Payer rule created successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin create payer rule error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create payer rule',
        details: error.message
      },
      { status: 500 }
    )
  }
}
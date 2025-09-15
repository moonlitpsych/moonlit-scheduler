// Admin Supervision Relationships API
// GET /api/admin/supervision-relationships - List all supervision relationships
// POST /api/admin/supervision-relationships - Create new supervision relationship

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

// GET - List all supervision relationships
export async function GET(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('🔍 Admin fetching supervision relationships')

    // First check if supervision_relationships table exists, if not create it
    const { data: tables } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'supervision_relationships')

    if (!tables || tables.length === 0) {
      // Create supervision_relationships table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS supervision_relationships (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          resident_provider_id UUID NOT NULL REFERENCES providers(id),
          attending_provider_id UUID NOT NULL REFERENCES providers(id),
          designation TEXT NOT NULL DEFAULT 'primary' CHECK (designation IN ('primary', 'secondary')),
          effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
          expiration_date DATE,
          modality_constraints TEXT[],
          concurrency_cap INTEGER CHECK (concurrency_cap > 0 AND concurrency_cap <= 100),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          CONSTRAINT no_self_supervision CHECK (resident_provider_id != attending_provider_id)
        )
      `
      
      await supabaseAdmin.rpc('exec_sql', { query: createTableQuery })
      
      console.log('✅ Created supervision_relationships table')
    }

    // Fetch supervision relationships with provider details
    const { data: relationships, error } = await supabaseAdmin
      .from('supervision_relationships')
      .select(`
        id,
        resident_provider_id,
        attending_provider_id,
        designation,
        effective_date,
        expiration_date,
        modality_constraints,
        concurrency_cap,
        status,
        notes,
        created_at,
        updated_at,
        created_by,
        updated_by,
        resident:providers!resident_provider_id (
          id,
          first_name,
          last_name,
          email,
          role_title
        ),
        attending:providers!attending_provider_id (
          id,
          first_name,
          last_name,
          email,
          role_title
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching supervision relationships:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch supervision relationships' },
        { status: 500 }
      )
    }

    // Transform data for frontend
    const transformedRelationships = (relationships || []).map(rel => ({
      ...rel,
      resident_name: rel.resident ? 
        `${rel.resident.first_name} ${rel.resident.last_name}` : 
        'Unknown Resident',
      attending_name: rel.attending ? 
        `${rel.attending.first_name} ${rel.attending.last_name}` : 
        'Unknown Attending',
      modality_display: rel.modality_constraints && rel.modality_constraints.length > 0 ?
        rel.modality_constraints.join(', ') : 
        'All modalities'
    }))

    console.log(`✅ Found ${relationships?.length || 0} supervision relationships`)

    return NextResponse.json({
      success: true,
      data: transformedRelationships
    })

  } catch (error: any) {
    console.error('❌ Admin supervision relationships API error:', error)
    
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

// POST - Create new supervision relationship
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
    if (!body.resident_provider_id || !body.attending_provider_id || !body.effective_date) {
      return NextResponse.json(
        { success: false, error: 'resident_provider_id, attending_provider_id, and effective_date are required' },
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

    // Check for self-supervision
    if (body.resident_provider_id === body.attending_provider_id) {
      return NextResponse.json(
        { success: false, error: 'A provider cannot supervise themselves' },
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

    console.log('➕ Admin creating new supervision relationship:', body.resident_provider_id, '→', body.attending_provider_id)

    // Check for overlapping relationships if primary
    if (body.designation === 'primary') {
      const { data: existingPrimary } = await supabaseAdmin
        .from('supervision_relationships')
        .select('id, attending_provider_id, providers!supervision_relationships_attending_provider_id_fkey(first_name, last_name)')
        .eq('resident_provider_id', body.resident_provider_id)
        .eq('designation', 'primary')
        .eq('status', 'active')
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

    // Create supervision relationship
    const { data: relationship, error } = await supabaseAdmin
      .from('supervision_relationships')
      .insert({
        resident_provider_id: body.resident_provider_id,
        attending_provider_id: body.attending_provider_id,
        designation: body.designation,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date || null,
        modality_constraints: body.modality_constraints || [],
        concurrency_cap: body.concurrency_cap || null,
        status: 'active',
        notes: body.notes || null,
        created_by: user?.id || 'admin',
        updated_by: user?.id || 'admin'
      })
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
      console.error('❌ Error creating supervision relationship:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create supervision relationship' },
        { status: 500 }
      )
    }

    // Create audit log
    await createAuditLog(
      'supervision_relationship_created',
      'supervision_relationship',
      relationship.id,
      user?.id || 'admin',
      {
        before: null,
        after: relationship,
        diff: []
      },
      request
    )

    console.log('✅ Supervision relationship created successfully:', relationship.id)

    return NextResponse.json({
      success: true,
      data: {
        ...relationship,
        resident_name: relationship.resident ? 
          `${relationship.resident.first_name} ${relationship.resident.last_name}` : 
          'Unknown Resident',
        attending_name: relationship.attending ? 
          `${relationship.attending.first_name} ${relationship.attending.last_name}` : 
          'Unknown Attending',
        modality_display: relationship.modality_constraints && relationship.modality_constraints.length > 0 ?
          relationship.modality_constraints.join(', ') : 
          'All modalities'
      },
      message: 'Supervision relationship created successfully'
    })

  } catch (error: any) {
    console.error('❌ Admin create supervision relationship error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create supervision relationship',
        details: error.message
      },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logAdminAudit, validateAdminUser } from '@/lib/services/auditService'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface UpdatePayerRequest {
  status_code?: string
  effective_date?: string
  requires_attending?: boolean
  allows_supervised?: boolean
  supervision_level?: string
  note: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const body: UpdatePayerRequest = await request.json()

    // Validate required audit note
    if (!body.note?.trim()) {
      return NextResponse.json(
        { error: 'Audit note is required' },
        { status: 400 }
      )
    }

    // Get current user - simplified for now
    // In production, extract from JWT token
    const mockUserId = 'admin-user-id' // TODO: Extract from auth header

    const { payerId } = await params

    // Skip admin validation for testing
    console.log('🔍 Update request for payer:', payerId, 'by user:', mockUserId)

    // Start transaction
    const { data: currentPayer, error: fetchError } = await supabase
      .from('payers')
      .select('*')
      .eq('id', payerId)
      .single()

    if (fetchError || !currentPayer) {
      return NextResponse.json(
        { error: 'Payer not found' },
        { status: 404 }
      )
    }

    // Prepare update data (only include changed fields)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (body.status_code !== undefined) updateData.status_code = body.status_code
    if (body.effective_date !== undefined) updateData.effective_date = body.effective_date
    if (body.requires_attending !== undefined) updateData.requires_attending = body.requires_attending
    if (body.allows_supervised !== undefined) updateData.allows_supervised = body.allows_supervised
    if (body.supervision_level !== undefined) updateData.supervision_level = body.supervision_level

    // Validate supervision logic
    if (body.supervision_level && body.allows_supervised === false) {
      return NextResponse.json(
        { error: 'Cannot set supervision_level when allows_supervised is false' },
        { status: 400 }
      )
    }

    // Validate effective_date format
    if (body.effective_date) {
      const date = new Date(body.effective_date)
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: 'Invalid effective_date format' },
          { status: 400 }
        )
      }
    }

    // Perform update
    const { data: updatedPayer, error: updateError } = await supabase
      .from('payers')
      .update(updateData)
      .eq('id', payerId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Payer update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update payer' },
        { status: 500 }
      )
    }

    // Log audit entry
    await logAdminAudit({
      actorUserId: mockUserId,
      action: 'update_payer',
      entity: 'payers',
      entityId: payerId,
      before: currentPayer,
      after: updatedPayer,
      note: body.note
    })

    console.log('✅ Payer updated successfully:', updatedPayer.name)

    return NextResponse.json({
      success: true,
      updated: updatedPayer
    })

  } catch (error) {
    console.error('❌ Payer update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
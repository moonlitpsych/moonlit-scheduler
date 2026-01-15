// Co-sign queue API - fetch and update queue items
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const payer = searchParams.get('payer')

    let query = supabase
      .from('cosign_queue')
      .select('*')
      .order('note_date', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (payer && payer !== 'all') {
      query = query.eq('payer_display_name', payer)
    }

    const { data: items, error } = await query.limit(100)

    if (error) {
      console.error('❌ [Co-Sign Queue] Fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unique payers for filter dropdown
    const { data: payersData } = await supabase
      .from('cosign_queue')
      .select('payer_display_name')
      .order('payer_display_name')

    const payers = [...new Set(payersData?.map(p => p.payer_display_name) || [])]

    return NextResponse.json({ items: items || [], payers })
  } catch (error: any) {
    console.error('❌ [Co-Sign Queue] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Manual status update
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { noteId, status, signedBy } = body

    if (!noteId || !status) {
      return NextResponse.json(
        { error: 'noteId and status are required' },
        { status: 400 }
      )
    }

    if (!['pending', 'signed', 'skipped'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, signed, or skipped' },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'signed') {
      updateData.signed_at = new Date().toISOString()
      updateData.signed_by = signedBy || 'Manual update'
    }

    const { error } = await supabase
      .from('cosign_queue')
      .update(updateData)
      .eq('note_id', noteId)

    if (error) {
      console.error('❌ [Co-Sign Queue] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Co-Sign Queue] Status updated:', { noteId, status })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [Co-Sign Queue] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

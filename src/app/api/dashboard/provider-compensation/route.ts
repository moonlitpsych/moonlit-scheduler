import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get provider record for this user
    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider not found' }, { status: 404 })
    }

    // Parse filters
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // all, paid, unpaid, ready
    const search = searchParams.get('search')?.toLowerCase()

    // Query v_appointments_grid for this provider
    const { data: appointments, error } = await supabaseAdmin
      .from('v_appointments_grid')
      .select('*')
      .eq('provider_id', provider.id)
      .not('appointment_status', 'in', '(cancelled,no_show)')
      .eq('is_test_data', false)
      .order('appt_date', { ascending: false })

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Build items
    let items = (appointments || []).map(a => {
      const earnedCents = a.provider_expected_pay_cents || 0
      const paidCents = a.provider_paid_cents || 0
      const reimbCents = a.reimbursement_cents || 0
      const isPaid = paidCents > 0
      const isReimbursed = reimbCents > 0

      let status: 'paid' | 'unpaid' | 'ready'
      if (isPaid) {
        status = 'paid'
      } else if (isReimbursed) {
        status = 'ready' // insurance paid, provider not yet
      } else {
        status = 'unpaid'
      }

      return {
        appointmentId: a.appointment_id,
        date: a.appt_date,
        patientLastName: a.last_name || 'Unknown',
        service: a.service || '',
        claimStatus: a.claim_status || null,
        earnedCents,
        paidCents,
        paidDate: a.provider_paid_date || null,
        reimbursedCents: reimbCents,
        status,
      }
    })

    // Apply search filter
    if (search) {
      items = items.filter(i =>
        i.patientLastName.toLowerCase().includes(search) ||
        i.service.toLowerCase().includes(search)
      )
    }

    // Apply status filter
    if (filter === 'paid') items = items.filter(i => i.status === 'paid')
    else if (filter === 'unpaid') items = items.filter(i => i.status === 'unpaid')
    else if (filter === 'ready') items = items.filter(i => i.status === 'ready')

    // Calculate summary (from unfiltered data)
    const allItems = (appointments || []).filter(a => !a.is_test_data)
    const totalEarnedCents = allItems.reduce((s, a) => s + (a.provider_expected_pay_cents || 0), 0)
    const totalPaidCents = allItems.reduce((s, a) => s + (a.provider_paid_cents || 0), 0)
    const totalOwedCents = totalEarnedCents - totalPaidCents
    const paidCount = allItems.filter(a => (a.provider_paid_cents || 0) > 0).length
    const readyCount = allItems.filter(a => (a.reimbursement_cents || 0) > 0 && !(a.provider_paid_cents || 0)).length

    return NextResponse.json({
      success: true,
      provider: { id: provider.id, name: `${provider.first_name} ${provider.last_name}` },
      items,
      summary: {
        totalAppointments: allItems.length,
        totalEarnedCents,
        totalPaidCents,
        totalOwedCents,
        paidCount,
        unpaidCount: allItems.length - paidCount,
        readyCount,
      },
    })
  } catch (error: any) {
    console.error('Provider compensation error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

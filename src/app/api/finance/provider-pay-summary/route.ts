// src/app/api/finance/provider-pay-summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/finance/provider-pay-summary
 *
 * Calculate provider balances based on reimbursed appointments
 *
 * Returns:
 * - Provider name
 * - Number of reimbursed but unpaid appointments
 * - Total earned (provider_expected_pay_cents)
 * - Total already paid (provider_paid_cents)
 * - Balance owed
 */
export async function GET(request: NextRequest) {
  try {
    // Query v_appointments_grid for reimbursed appointments
    const { data, error } = await supabaseAdmin
      .from('v_appointments_grid')
      .select(`
        provider_id,
        practitioner,
        provider_expected_pay_cents,
        provider_paid_cents,
        appointment_id
      `)
      .not('reimbursement_cents', 'is', null)  // Only reimbursed appointments

    if (error) {
      console.error('Query error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        summary: []
      })
    }

    // Group by provider and calculate balances
    const providerMap = new Map<string, {
      provider_id: string
      provider_name: string
      reimbursed_appointments: number
      earned_cents: number
      paid_cents: number
      balance_owed_cents: number
    }>()

    for (const row of data) {
      const providerId = row.provider_id
      const providerName = row.practitioner
      const earnedCents = row.provider_expected_pay_cents || 0
      const paidCents = row.provider_paid_cents || 0

      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          provider_id: providerId,
          provider_name: providerName,
          reimbursed_appointments: 0,
          earned_cents: 0,
          paid_cents: 0,
          balance_owed_cents: 0
        })
      }

      const providerData = providerMap.get(providerId)!
      providerData.reimbursed_appointments += 1
      providerData.earned_cents += earnedCents
      providerData.paid_cents += paidCents
      providerData.balance_owed_cents = providerData.earned_cents - providerData.paid_cents
    }

    // Convert to array and filter out providers with zero balance
    const summary = Array.from(providerMap.values())
      .filter(p => p.balance_owed_cents > 0)  // Only show providers who are owed money
      .sort((a, b) => b.balance_owed_cents - a.balance_owed_cents)  // Sort by highest balance first

    return NextResponse.json({
      success: true,
      summary,
      metadata: {
        total_providers_owed: summary.length,
        total_balance_owed_cents: summary.reduce((sum, p) => sum + p.balance_owed_cents, 0)
      }
    })

  } catch (error: any) {
    console.error('Provider pay summary error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

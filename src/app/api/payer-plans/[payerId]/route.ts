import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { PayerPlanInfo, PayerPlanDisplayData, GetPayerPlansResponse } from '@/types/payer-plans'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payer-plans/[payerId]
 *
 * Fetches all plans for a given payer, partitioned by acceptance status.
 * Returns three lists: accepted (in-network), not accepted (out-of-network), and needs review (unknown).
 *
 * Query Parameters:
 *   - providerId (optional): If provided, applies provider-specific overrides
 *
 * Returns:
 *   - 200: { success: true, data: PayerPlanDisplayData }
 *   - 400: { success: false, error: "Invalid payer ID" }
 *   - 500: { success: false, error: "Error message" }
 */
export async function GET(
  request: Request,
  { params }: { params: { payerId: string } }
) {
  try {
    const { payerId } = params
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId') || undefined

    // Validate payer ID (basic UUID format check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(payerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payer ID format' } as GetPayerPlansResponse,
        { status: 400 }
      )
    }

    // Initialize Supabase client with service key for RPC access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the get_payer_plans_for_ui database function
    const { data: plans, error: dbError } = await supabase
      .rpc('get_payer_plans_for_ui', {
        in_payer_id: payerId,
        in_provider_id: providerId || null
      })

    if (dbError) {
      console.error('Error fetching payer plans:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }

    if (!plans || plans.length === 0) {
      // No plans found for this payer - return empty lists
      return NextResponse.json({
        success: true,
        data: {
          payer_id: payerId,
          payer_name: 'Unknown Payer',
          accepted: [],
          notAccepted: [],
          needsReview: []
        }
      } as GetPayerPlansResponse)
    }

    // Partition plans by acceptance_status
    const accepted: PayerPlanInfo[] = []
    const notAccepted: PayerPlanInfo[] = []
    const needsReview: PayerPlanInfo[] = []

    for (const plan of plans as PayerPlanInfo[]) {
      switch (plan.acceptance_status) {
        case 'in_network':
          accepted.push(plan)
          break
        case 'not_in_network':
          notAccepted.push(plan)
          break
        case 'unknown':
          needsReview.push(plan)
          break
        default:
          console.warn(`Unknown acceptance_status: ${plan.acceptance_status} for plan ${plan.plan_id}`)
          needsReview.push(plan) // Treat unknown statuses as needs review
      }
    }

    const response: PayerPlanDisplayData = {
      payer_id: payerId,
      payer_name: plans[0]?.payer_name || 'Unknown Payer',
      accepted,
      notAccepted,
      needsReview
    }

    return NextResponse.json({
      success: true,
      data: response
    } as GetPayerPlansResponse)

  } catch (error: any) {
    console.error('Error in GET /api/payer-plans/[payerId]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch payer plans'
      } as GetPayerPlansResponse,
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Payer {
  id: string
  name: string
  payer_type: string
  state: string
  status_code: string
  effective_date: string | null
  projected_effective_date: string | null
}

interface GroupedPayers {
  [state: string]: {
    active: Payer[]
    projected: Payer[]
    selfPay: Payer[]
  }
}

export async function GET() {
  try {

    // Normalize state codes to display names
    // Only Utah and Idaho are recognized - anything else gets filtered out
    const normalizeStateCode = (state: string): string | null => {
      switch(state?.toUpperCase()) {
        case 'UT':
        case 'UTAH':
          return 'Utah'
        case 'ID':
        case 'IDAHO':
          return 'Idaho'
        default:
          // Any other state (CA, National, Other, etc.) returns null to be filtered out
          return null
      }
    }

    // First, determine which states we actively operate in
    // A state is "active" if we have at least one approved payer with an effective date there
    const { data: activeStatePayers, error: activeError } = await supabase
      .from('payers')
      .select('state')
      .eq('status_code', 'approved')
      .not('effective_date', 'is', null)

    if (activeError) {
      console.error('❌ Error fetching active states:', activeError)
      return NextResponse.json({ error: 'Failed to fetch active states' }, { status: 500 })
    }

    // Extract unique normalized state names where we actively accept insurance
    // Only includes Utah and Idaho - filters out National, CA, Other, etc.
    const allowedStates = new Set(
      activeStatePayers
        ?.map(p => normalizeStateCode(p.state))
        .filter((state): state is string => state !== null) || []
    )

    console.log('📍 Active states:', Array.from(allowedStates))

    // Fetch only relevant payers - exclude not_started, denied, on_pause, blocked, withdrawn
    const { data: payers, error } = await supabase
      .from('payers')
      .select('id, name, payer_type, state, status_code, effective_date, projected_effective_date')
      .not('status_code', 'in', '(not_started,denied,on_pause,blocked,withdrawn)')
      .order('state')
      .order('effective_date', { nullsLast: true })

    if (error) {
      console.error('❌ Error fetching payers:', error)
      return NextResponse.json({ error: 'Failed to fetch payers' }, { status: 500 })
    }

    if (!payers || payers.length === 0) {
      console.log('⚠️ No payers found in database')
      return NextResponse.json({})
    }

    // Group payers by state and status
    // Only include payers from states where Moonlit has licensed providers
    const groupedPayers: GroupedPayers = {}

    payers.forEach((payer) => {
      const state = normalizeStateCode(payer.state)

      // Skip payers from unrecognized states (CA, National, Other, etc.)
      // or states where we don't have active payers
      if (!state || !allowedStates.has(state)) {
        return
      }
      
      if (!groupedPayers[state]) {
        groupedPayers[state] = {
          active: [],
          projected: [],
          selfPay: []
        }
      }

      // Categorize payers
      if (payer.payer_type === 'self_pay') {
        groupedPayers[state].selfPay.push(payer as Payer)
      } else if (payer.status_code === 'approved') {
        // All approved payers should show somewhere
        if (payer.effective_date) {
          // Approved with effective date - goes to active (regardless of past/future)
          groupedPayers[state].active.push(payer as Payer)
        } else if (payer.projected_effective_date) {
          // Approved with only projected date - goes to projected
          groupedPayers[state].projected.push(payer as Payer)
        } else {
          // Approved but no dates - goes to projected
          groupedPayers[state].projected.push(payer as Payer)
        }
      } else {
        // Any other status_code (in_progress, waiting_on_them, etc.) - goes to projected
        groupedPayers[state].projected.push(payer as Payer)
      }
    })

    console.log('✅ Successfully fetched and grouped payers:', {
      totalPayers: payers.length,
      licensedStates: Array.from(allowedStates),
      displayedStates: Object.keys(groupedPayers)
    })

    return NextResponse.json(groupedPayers)

  } catch (error) {
    console.error('❌ Unexpected error in ways-to-pay API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Payer {
  id: string
  name: string
  payer_type: string
  state: string
  credentialing_status: string
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
    
    // Fetch only relevant payers - exclude not_started, denied, on_pause, blocked, withdrawn
    const { data: payers, error } = await supabase
      .from('payers')
      .select('id, name, payer_type, state, credentialing_status, effective_date, projected_effective_date')
      .not('credentialing_status', 'in', '(not_started,denied,on_pause,blocked,withdrawn)')
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
    const groupedPayers: GroupedPayers = {}

    payers.forEach((payer) => {
      // Normalize state names
      const normalizeState = (state: string) => {
        switch(state?.toUpperCase()) {
          case 'UT':
          case 'UTAH':
            return 'Utah'
          case 'ID':
          case 'IDAHO':
            return 'Idaho'
          default:
            return state || 'Other'
        }
      }
      
      const state = normalizeState(payer.state)
      
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
      } else if (payer.credentialing_status === 'approved') {
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
        // Any other credentialing status (in_progress, waiting_on_them, etc.) - goes to projected
        groupedPayers[state].projected.push(payer as Payer)
      }
    })

    console.log('✅ Successfully fetched and grouped payers:', {
      totalPayers: payers.length,
      states: Object.keys(groupedPayers)
    })

    return NextResponse.json(groupedPayers)

  } catch (error) {
    console.error('❌ Unexpected error in ways-to-pay API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
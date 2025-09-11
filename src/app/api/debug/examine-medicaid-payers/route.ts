import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get all payers with detailed information
    const { data: payers, error } = await supabase
      .from('payers')
      .select('id, name, payer_type, state, status_code, effective_date, projected_effective_date, notes')
      .order('state')
      .order('name')

    if (error) {
      console.error('❌ Error fetching payers:', error)
      return NextResponse.json({ error: 'Failed to fetch payers' }, { status: 500 })
    }

    // Analyze Utah payers specifically
    const utahPayers = payers?.filter(p => 
      p.state?.toUpperCase() === 'UT' || p.state?.toUpperCase() === 'UTAH'
    ) || []

    // Look for medicaid-related patterns
    const medicaidPatterns = utahPayers.filter(p => 
      p.name?.toLowerCase().includes('medicaid') ||
      p.name?.toLowerCase().includes('molina') ||
      p.name?.toLowerCase().includes('optum') ||
      p.payer_type?.toLowerCase().includes('medicaid')
    )

    // Group by payer_type to understand categorization
    const payersByType = payers?.reduce((acc, payer) => {
      const type = payer.payer_type || 'unspecified'
      if (!acc[type]) acc[type] = []
      acc[type].push({
        name: payer.name,
        state: payer.state,
        status: payer.status_code
      })
      return acc
    }, {} as Record<string, any[]>) || {}

    return NextResponse.json({
      totalPayers: payers?.length || 0,
      utahPayersCount: utahPayers.length,
      medicaidPatternsFound: medicaidPatterns.length,
      utahPayers: utahPayers.map(p => ({
        name: p.name,
        payer_type: p.payer_type,
        status_code: p.status_code,
        notes: p.notes?.substring(0, 100) + (p.notes?.length > 100 ? '...' : '')
      })),
      medicaidPatterns: medicaidPatterns.map(p => ({
        name: p.name,
        payer_type: p.payer_type,
        status_code: p.status_code
      })),
      payerTypeBreakdown: Object.entries(payersByType).map(([type, payers]) => ({
        type,
        count: payers.length,
        examples: payers.slice(0, 3)
      }))
    })

  } catch (error) {
    console.error('❌ Unexpected error examining payers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
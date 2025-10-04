import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// IntakeQ practitioner IDs fetched from IntakeQ API
const INTAKEQ_IDS = [
  { firstName: 'Travis', lastName: 'Norseth', intakeqId: '674f75864066453dbd5db757' },
  { firstName: 'Tatiana', lastName: 'Kaehler', intakeqId: '6838a1c65752f5b216563846' },
  { firstName: 'Merrick', lastName: 'Reynolds', intakeqId: '6848eada36472707ced63b78' },
  { firstName: 'Rufus', lastName: 'Sweeney', intakeqId: '685ee0c8bf742b8ede28f37e' }
]

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting IntakeQ ID seeding...')

    const results = []

    for (const provider of INTAKEQ_IDS) {
      // Update provider with IntakeQ ID
      const { data, error } = await supabase
        .from('providers')
        .update({ intakeq_practitioner_id: provider.intakeqId })
        .eq('first_name', provider.firstName)
        .eq('last_name', provider.lastName)
        .select('id, first_name, last_name, intakeq_practitioner_id')

      if (error) {
        console.error(`❌ Failed to update ${provider.firstName} ${provider.lastName}:`, error)
        results.push({
          provider: `${provider.firstName} ${provider.lastName}`,
          status: 'error',
          error: error.message
        })
      } else if (data && data.length > 0) {
        console.log(`✅ Updated ${provider.firstName} ${provider.lastName} with IntakeQ ID: ${provider.intakeqId}`)
        results.push({
          provider: `${provider.firstName} ${provider.lastName}`,
          status: 'success',
          intakeqId: provider.intakeqId,
          data: data[0]
        })
      } else {
        console.warn(`⚠️ Provider ${provider.firstName} ${provider.lastName} not found`)
        results.push({
          provider: `${provider.firstName} ${provider.lastName}`,
          status: 'not_found'
        })
      }
    }

    // Fetch all bookable providers to show current status
    const { data: allProviders, error: fetchError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, intakeq_practitioner_id, is_bookable')
      .eq('is_bookable', true)
      .order('last_name')

    return NextResponse.json({
      success: true,
      message: 'IntakeQ IDs seeding complete',
      results,
      currentStatus: allProviders || [],
      summary: {
        total: INTAKEQ_IDS.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        notFound: results.filter(r => r.status === 'not_found').length
      }
    })

  } catch (error: any) {
    console.error('❌ Seeding failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
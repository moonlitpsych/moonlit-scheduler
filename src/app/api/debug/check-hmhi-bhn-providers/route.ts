import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Checking providers for HMHI BHN payer...')

    // Get HMHI BHN payer
    const { data: payer, error: payerError } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%HMHI%BHN%')
      .single()

    if (payerError || !payer) {
      return NextResponse.json({
        success: false,
        error: 'HMHI BHN payer not found',
        details: payerError
      })
    }

    // Get all providers bookable for this payer (from canonical view)
    const { data: bookableProviders, error: bookableError } = await supabaseAdmin
      .from('v_bookable_provider_payer')
      .select('provider_id')
      .eq('payer_id', payer.id)

    if (bookableError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch bookable providers',
        details: bookableError
      })
    }

    // Now check which ones have accepts_new_patients=true
    const providerIds = bookableProviders?.map(p => p.provider_id) || []
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, accepts_new_patients, is_bookable')
      .in('id', providerIds)

    if (providersError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch provider details',
        details: providersError
      })
    }

    // Check Dr. Reynolds specifically
    const { data: reynolds, error: reynoldsError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, accepts_new_patients, is_bookable')
      .ilike('last_name', 'reynolds')
      .single()

    // Check if Reynolds is in the bookable list
    const reynoldsIsBookableForPayer = bookableProviders?.some(
      p => p.provider_id === reynolds?.id
    )

    // Separate providers by accepts_new_patients status
    const acceptingNew = providers?.filter(p => p.accepts_new_patients) || []
    const notAcceptingNew = providers?.filter(p => !p.accepts_new_patients) || []

    return NextResponse.json({
      success: true,
      payer: {
        id: payer.id,
        name: payer.name
      },
      summary: {
        totalBookableProviders: bookableProviders?.length || 0,
        providersAcceptingNew: acceptingNew.length,
        providersNotAcceptingNew: notAcceptingNew.length
      },
      bookableProvidersFromView: bookableProviders?.map(p => ({
        provider_id: p.provider_id
      })),
      providersWithDetails: providers?.map(p => ({
        id: p.id,
        name: `Dr. ${p.first_name} ${p.last_name}`,
        accepts_new_patients: p.accepts_new_patients,
        is_bookable: p.is_bookable,
        willShowInBookingFlow: p.accepts_new_patients && p.is_bookable
      })),
      drReynolds: reynolds ? {
        id: reynolds.id,
        name: `Dr. ${reynolds.first_name} ${reynolds.last_name}`,
        accepts_new_patients: reynolds.accepts_new_patients,
        is_bookable: reynolds.is_bookable,
        isBookableForHMHIBHN: reynoldsIsBookableForPayer,
        willShowInBookingFlow: reynolds.accepts_new_patients && reynolds.is_bookable && reynoldsIsBookableForPayer,
        reason: !reynoldsIsBookableForPayer
          ? 'Not in v_bookable_provider_payer for HMHI BHN'
          : !reynolds.accepts_new_patients
          ? 'accepts_new_patients = false (filtered by feature flag)'
          : !reynolds.is_bookable
          ? 'is_bookable = false'
          : 'Should show in booking flow'
      } : {
        error: 'Dr. Reynolds not found',
        details: reynoldsError
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

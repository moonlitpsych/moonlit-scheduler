/**
 * Admin Health Check: Provider Intake Filter Status
 *
 * Reports which providers are excluded from intake booking flows
 * when INTAKE_HIDE_NON_INTAKE_PROVIDERS feature flag is enabled.
 *
 * READ-ONLY endpoint - no data modifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { featureFlags } from '@/lib/config/featureFlags'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin health check: Provider intake filter status')

    // Get all bookable providers with their intake status
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select(`
        id,
        first_name,
        last_name,
        title,
        role,
        is_bookable,
        accepts_new_patients,
        intakeq_practitioner_id
      `)
      .eq('is_bookable', true)
      .order('last_name', { ascending: true })

    if (error) {
      console.error('❌ Error fetching providers:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: error },
        { status: 500 }
      )
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({
        success: true,
        featureFlag: {
          enabled: featureFlags.intakeHideNonIntakeProviders,
          name: 'INTAKE_HIDE_NON_INTAKE_PROVIDERS'
        },
        summary: {
          totalBookable: 0,
          acceptingNewPatients: 0,
          notAcceptingNewPatients: 0,
          noIntakeqMapping: 0
        },
        providers: []
      })
    }

    // Categorize providers
    const acceptingNew = providers.filter(p =>
      p.accepts_new_patients && p.intakeq_practitioner_id
    )
    const notAcceptingNew = providers.filter(p =>
      !p.accepts_new_patients && p.intakeq_practitioner_id
    )
    const noIntakeqMapping = providers.filter(p =>
      !p.intakeq_practitioner_id
    )

    // Build detailed report
    const providerDetails = providers.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      title: p.title,
      role: p.role,
      isBookable: p.is_bookable,
      acceptsNewPatients: p.accepts_new_patients,
      hasIntakeqMapping: !!p.intakeq_practitioner_id,
      // This provider would be filtered out if:
      // 1. Feature flag is ON AND
      // 2. Either accepts_new_patients=false OR no IntakeQ mapping
      filteredWhenFlagEnabled: !p.accepts_new_patients || !p.intakeq_practitioner_id,
      reason: !p.accepts_new_patients
        ? 'Not accepting new patients'
        : !p.intakeq_practitioner_id
        ? 'No IntakeQ mapping'
        : 'Available for intake bookings'
    }))

    const summary = {
      totalBookable: providers.length,
      acceptingNewPatients: acceptingNew.length,
      notAcceptingNewPatients: notAcceptingNew.length,
      noIntakeqMapping: noIntakeqMapping.length,
      wouldBeFilteredIfEnabled: providerDetails.filter(p => p.filteredWhenFlagEnabled).length
    }

    console.log('📊 Provider intake filter report:', summary)

    return NextResponse.json({
      success: true,
      featureFlag: {
        enabled: featureFlags.intakeHideNonIntakeProviders,
        name: 'INTAKE_HIDE_NON_INTAKE_PROVIDERS',
        description: 'When enabled, filters out providers not accepting new patients from intake booking flows'
      },
      summary,
      providers: providerDetails,
      filteredProviders: providerDetails.filter(p => p.filteredWhenFlagEnabled),
      availableProviders: providerDetails.filter(p => !p.filteredWhenFlagEnabled)
    })

  } catch (error: any) {
    console.error('❌ Admin health check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

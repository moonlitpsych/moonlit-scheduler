// src/app/api/demo/enhanced-providers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const payerId = searchParams.get('payer_id')

    if (!payerId || payerId === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Payer ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching real providers for payer:', payerId)

    // DEBUGGING: First check what's in the provider_payer_networks table
    const { data: debugNetworks, error: debugError } = await supabase
      .from('provider_payer_networks')
      .select('*')
      .eq('payer_id', payerId)
    
    console.log('🔍 DEBUG: Raw provider_payer_networks for this payer:', {
      payerId,
      networkCount: debugNetworks?.length || 0,
      networks: debugNetworks,
      error: debugError
    })

    // Get providers who accept this payer - using real Supabase data only
    const { data: networks, error: networksError } = await supabase
      .from('provider_payer_networks')
      .select(`
        provider_id,
        effective_date,
        status,
        providers!inner (
          id,
          first_name,
          last_name,
          title,
          role,
          is_active,
          accepts_new_patients,
          telehealth_enabled,
          languages_spoken,
          profile_image_url,
          email,
          phone_number
        )
      `)
      .eq('payer_id', payerId)
      .eq('status', 'in_network')
      .eq('providers.is_active', true)

    if (networksError) {
      console.error('❌ Error fetching provider networks:', networksError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch providers', details: networksError },
        { status: 500 }
      )
    }

    const providers = networks?.map(n => n.providers) || []
    console.log(`👥 Found ${providers.length} providers using real Supabase data`)

    // Use only real Supabase data - no mock/demo enhancements
    const realProviders = providers.map(provider => {
      return {
        id: provider.id,
        first_name: provider.first_name,
        last_name: provider.last_name,
        full_name: `${provider.first_name} ${provider.last_name}`,
        title: provider.title || provider.role || 'Provider',
        role: provider.role,
        is_active: provider.is_active,
        accepts_new_patients: provider.accepts_new_patients,
        telehealth_enabled: provider.telehealth_enabled,
        languages_spoken: provider.languages_spoken || [], // Real Supabase field, may be null
        profile_image_url: provider.profile_image_url,
        email: provider.email,
        phone_number: provider.phone_number,
        
        // Derived fields for UI
        new_patient_status: provider.accepts_new_patients ? 'New Patients' : 'Existing Patients Only',
        telehealth_status: provider.telehealth_enabled ? 'Telehealth Available' : 'In-person Only',
        languages_display: provider.languages_spoken?.length > 0 ? provider.languages_spoken : ['English'], // Default only if null
        display_name: provider.title ? 
          `${provider.first_name} ${provider.last_name}, ${provider.title}` : 
          `${provider.first_name} ${provider.last_name}`,
        specialty: provider.role || 'Mental Health Provider' // Using role as specialty until we add a specialty field
      }
    })

    const response = {
      success: true,
      payer_id: payerId,
      provider_count: realProviders.length,
      providers: realProviders,
      data_source: 'real_supabase_data',
      mock_data_removed: true,
      message: 'Using only real database fields - no mock/demo data'
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Provider fetch error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Provider fetch failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'POST method not implemented for real providers endpoint' },
    { status: 501 }
  )
}
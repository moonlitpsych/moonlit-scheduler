// src/app/api/demo/enhanced-providers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Enhanced provider data for demo purposes
const providerEnhancements: Record<string, any> = {
  'Travis Norseth': {
    title: 'MD, Psychiatrist',
    bio: 'Dr. Norseth specializes in adult psychiatry with a focus on anxiety, depression, and ADHD. He has 8 years of experience in both inpatient and outpatient settings.',
    languages_spoken: ['English', 'Norwegian'],
    specialty: 'Adult Psychiatry',
    provider_type: 'Psychiatrist',
    years_experience: 8,
    education: 'University of Utah School of Medicine',
    consultation_fee: 250,
    follow_up_fee: 150,
    image_url: '/providers/travis-norseth.jpg',
    appointment_types: ['Initial Consultation', 'Follow-up', 'Medication Management'],
    availability_note: 'Available for both telehealth and in-person appointments'
  },
  'Tatiana Kaehler': {
    title: 'MD, Psychiatry Resident',
    bio: 'Dr. Kaehler is a psychiatry resident with special interests in mood disorders and trauma-informed care. She provides compassionate, evidence-based treatment.',
    languages_spoken: ['English', 'Spanish'],
    specialty: 'General Psychiatry',
    provider_type: 'Resident',
    years_experience: 2,
    education: 'University of Utah School of Medicine',
    consultation_fee: 180,
    follow_up_fee: 120,
    image_url: '/providers/tatiana-kaehler.jpg',
    appointment_types: ['Initial Consultation', 'Follow-up', 'Therapy'],
    availability_note: 'Excellent availability for new patients'
  },
  'Mitchell Allen': {
    title: 'PsyD, Clinical Psychologist',
    bio: 'Dr. Allen provides cognitive behavioral therapy and specializes in working with young adults facing life transitions and adjustment challenges.',
    languages_spoken: ['English'],
    specialty: 'Clinical Psychology',
    provider_type: 'Psychologist',
    years_experience: 5,
    education: 'Pacific University',
    consultation_fee: 200,
    follow_up_fee: 160,
    image_url: '/providers/mitchell-allen.jpg',
    appointment_types: ['Initial Consultation', 'Therapy', 'Psychological Assessment'],
    availability_note: 'Specializes in evening appointments for working professionals'
  },
  'Gisele Braga': {
    title: 'LCSW, Licensed Clinical Social Worker',
    bio: 'Gisele specializes in trauma therapy, family counseling, and culturally responsive mental health care with bilingual Spanish-English services.',
    languages_spoken: ['English', 'Spanish', 'Portuguese'],
    specialty: 'Clinical Social Work',
    provider_type: 'Licensed Therapist',
    years_experience: 7,
    education: 'University of Utah College of Social Work',
    consultation_fee: 150,
    follow_up_fee: 120,
    image_url: '/providers/gisele-braga.jpg',
    appointment_types: ['Initial Consultation', 'Individual Therapy', 'Family Therapy'],
    availability_note: 'Bilingual services available in Spanish and Portuguese'
  },
  'C. Rufus Sweeney': {
    title: 'MD, Psychiatrist', 
    bio: 'Dr. Sweeney provides comprehensive psychiatric care with expertise in mood disorders, anxiety, and therapy integration. Known for his collaborative approach to mental health.',
    languages_spoken: ['English'],
    specialty: 'Adult Psychiatry',
    provider_type: 'Psychiatrist',
    years_experience: 8,
    education: 'University of Utah School of Medicine',
    consultation_fee: 250,
    follow_up_fee: 150,
    image_url: '/providers/rufus-sweeney.jpg',
    appointment_types: ['Initial Consultation', 'Follow-up', 'Medication Management'],
    availability_note: 'Available for both telehealth and in-person appointments'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const payerId = searchParams.get('payer_id')
    const format = searchParams.get('format') || 'cards' // 'cards' or 'list'

    console.log('🎭 Demo: Fetching enhanced providers for UX demo')

    if (!payerId) {
      return NextResponse.json(
        { success: false, error: 'payer_id is required' },
        { status: 400 }
      )
    }

    // Get providers who accept this payer (using existing logic)
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
          telehealth_enabled
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
    console.log(`👥 Found ${providers.length} providers for demo enhancement`)

    // Enhance each provider with demo data
    const enhancedProviders = providers.map(provider => {
      const fullName = `${provider.first_name} ${provider.last_name}`
      const enhancement = providerEnhancements[fullName] || {}

      return {
        ...provider,
        // Enhanced demo data
        title: enhancement.title || `${provider.role || 'Provider'}`,
        bio: enhancement.bio || `${provider.first_name} ${provider.last_name} is a dedicated mental health professional.`,
        languages_spoken: enhancement.languages_spoken || ['English'],
        specialty: enhancement.specialty || 'Mental Health',
        provider_type: enhancement.provider_type || 'Provider',
        years_experience: enhancement.years_experience || 5,
        education: enhancement.education || 'Medical School',
        consultation_fee: enhancement.consultation_fee || 200,
        follow_up_fee: enhancement.follow_up_fee || 150,
        image_url: enhancement.image_url || '/providers/default.jpg',
        appointment_types: enhancement.appointment_types || ['Consultation', 'Follow-up'],
        availability_note: enhancement.availability_note || 'Standard availability',
        
        // Calculated fields for UX
        full_name: fullName,
        display_name: `Dr. ${provider.first_name} ${provider.last_name}`,
        price_range: `$${enhancement.follow_up_fee || 150} - $${enhancement.consultation_fee || 200}`,
        languages_display: (enhancement.languages_spoken || ['English']).join(', '),
        telehealth_status: provider.telehealth_enabled ? 'Available' : 'In-person only',
        new_patient_status: provider.accepts_new_patients ? 'Accepting new patients' : 'Not accepting new patients'
      }
    })

    // Sort by provider type (Psychiatrists first, then by experience)
    enhancedProviders.sort((a, b) => {
      const typeOrder = { 'Psychiatrist': 1, 'Resident': 2, 'Psychologist': 3, 'Licensed Therapist': 4 }
      const aOrder = typeOrder[a.provider_type as keyof typeof typeOrder] || 5
      const bOrder = typeOrder[b.provider_type as keyof typeof typeOrder] || 5
      
      if (aOrder !== bOrder) return aOrder - bOrder
      return (b.years_experience || 0) - (a.years_experience || 0)
    })

    const response = {
      success: true,
      demo_mode: true,
      data: {
        payer_id: payerId,
        providers: enhancedProviders,
        total_providers: enhancedProviders.length,
        provider_types: [...new Set(enhancedProviders.map(p => p.provider_type))],
        languages_available: [...new Set(enhancedProviders.flatMap(p => p.languages_spoken))],
        specialties: [...new Set(enhancedProviders.map(p => p.specialty))],
        format: format
      },
      user_stories_addressed: [
        'User Story #10: Option to scroll through all practitioners',
        'User Story #21: Book by Practitioner shows only insurance-accepting providers',
        'User Story #22: Provider cards with detailed information'
      ]
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Demo providers error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        demo_mode: true,
        error: 'Demo provider fetch failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider_id, action } = await request.json()

    if (action === 'get_availability') {
      // Get provider-specific availability (User Story #23)
      console.log(`📅 Demo: Getting availability for provider ${provider_id}`)

      // Use existing availability endpoint but filter for specific provider
      const { data: availability, error } = await supabase
        .from('provider_availability')
        .select('*')
        .eq('provider_id', provider_id)
        .eq('is_recurring', true)
        .order('day_of_week', { ascending: true })

      if (error) {
        console.error('❌ Error fetching provider availability:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch availability' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        demo_mode: true,
        data: {
          provider_id,
          availability: availability || [],
          total_slots: availability?.length || 0,
          message: `Isolated availability for selected provider`
        },
        user_story_addressed: 'User Story #23: Calendar that isolates just that practitioner\'s availability'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('❌ Demo provider action error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Demo action failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
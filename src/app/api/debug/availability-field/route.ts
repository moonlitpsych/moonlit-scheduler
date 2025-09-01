import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Debugging availability field...')

    // Get all providers and check their availability field
    const { data: providers, error } = await supabaseAdmin
      .from('providers')
      .select(`
        id,
        first_name,
        last_name,
        availability,
        accepts_new_patients
      `)
      .limit(10)

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch providers',
        details: error.message
      }, { status: 500 })
    }

    // Analyze the availability field
    const analysis = providers?.map(provider => ({
      name: `${provider.first_name} ${provider.last_name}`,
      availability: provider.availability,
      availability_type: typeof provider.availability,
      availability_is_null: provider.availability === null,
      availability_is_undefined: provider.availability === undefined,
      accepts_new_patients: provider.accepts_new_patients,
      accepts_type: typeof provider.accepts_new_patients
    }))

    return NextResponse.json({
      success: true,
      total_providers: providers?.length || 0,
      analysis,
      field_types: {
        availability_field_exists: providers?.[0]?.hasOwnProperty('availability'),
        sample_availability_value: providers?.[0]?.availability,
        sample_availability_type: typeof providers?.[0]?.availability
      }
    })

  } catch (error) {
    console.error('❌ Debug failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error.message
    }, { status: 500 })
  }
}
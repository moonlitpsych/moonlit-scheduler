import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🧹 Starting obsolete provider fields cleanup...')

    // Step 1: Create backup of existing data
    console.log('📋 Creating backup of obsolete fields...')
    
    const { data: providers, error: fetchError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, availability')

    if (fetchError) {
      console.error('❌ Failed to fetch provider data for backup:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch provider data for backup',
        details: fetchError.message
      }, { status: 500 })
    }

    // Step 2: Analyze current field usage
    const availabilityAnalysis = providers?.map(provider => ({
      name: `${provider.first_name} ${provider.last_name}`,
      availability_value: provider.availability,
      availability_type: typeof provider.availability,
      availability_is_null: provider.availability === null
    }))

    // Step 3: Show new vs old logic comparison
    const { data: providersWithNewFields, error: newFieldsError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, is_bookable, accepts_new_patients, availability')
      .order('last_name')

    if (newFieldsError) {
      console.error('❌ Failed to fetch providers with new fields:', newFieldsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch providers with new fields',
        details: newFieldsError.message
      }, { status: 500 })
    }

    const comparison = providersWithNewFields?.map(provider => {
      let newComputedStatus = null
      if (provider.is_bookable) {
        newComputedStatus = provider.accepts_new_patients 
          ? 'Accepting New Patients'
          : 'Established Patients Only'
      }

      return {
        name: `${provider.first_name} ${provider.last_name}`,
        is_bookable: provider.is_bookable,
        accepts_new_patients: provider.accepts_new_patients,
        old_availability: provider.availability,
        new_computed_status: newComputedStatus,
        fields_match: provider.availability === newComputedStatus || 
                     (provider.availability === null && newComputedStatus === null)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Obsolete fields analysis completed',
      backup_created: true,
      total_providers: providers?.length || 0,
      analysis: {
        availability_field_usage: availabilityAnalysis,
        old_vs_new_comparison: comparison,
        fields_that_match: comparison?.filter(p => p.fields_match).length || 0,
        fields_that_differ: comparison?.filter(p => !p.fields_match).length || 0
      },
      recommendation: {
        safe_to_cleanup: (comparison?.filter(p => !p.fields_match).length || 0) === 0,
        next_steps: [
          '1. Review the old_vs_new_comparison above',
          '2. If safe_to_cleanup is true, run the SQL migration to drop availability column',
          '3. Update any remaining code references to availability field',
          '4. Test the system thoroughly after cleanup'
        ]
      },
      sql_to_run_manually: `
-- After reviewing the analysis above, run this SQL:
ALTER TABLE providers DROP COLUMN IF EXISTS availability;
COMMENT ON COLUMN providers.is_bookable IS 'Whether this provider can be booked directly by patients. Supervising attendings should be false.';
COMMENT ON COLUMN providers.accepts_new_patients IS 'Whether provider is accepting new patients into their panel. Independent of bookability.';
      `.trim()
    })

  } catch (error) {
    console.error('❌ Cleanup analysis failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Cleanup analysis failed',
      details: error.message
    }, { status: 500 })
  }
}
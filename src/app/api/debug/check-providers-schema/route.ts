import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        console.log('🔍 Checking providers table schema...')
        
        // Get a sample provider record to see what fields exist
        const { data: sampleProvider, error: providerError } = await supabaseAdmin
            .from('providers')
            .select('*')
            .limit(1)
            .single()

        if (providerError) {
            console.error('❌ Error fetching sample provider:', providerError)
            return NextResponse.json({ error: providerError.message }, { status: 500 })
        }

        // Get all providers to check is_bookable field
        const { data: allProviders, error: allProvidersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name, is_active, is_bookable, accepts_new_patients')
            .eq('is_active', true)

        if (allProvidersError) {
            console.error('❌ Error fetching providers with is_bookable:', allProvidersError)
        }

        // Try to query for bookable table (just in case)
        const { data: bookableCheck, error: bookableError } = await supabaseAdmin
            .from('bookable')
            .select('*')
            .limit(1)

        // Try bookable_providers table
        const { data: bookableProvidersCheck, error: bookableProvidersError } = await supabaseAdmin
            .from('bookable_providers')
            .select('*')
            .limit(1)

        const response = {
            sample_provider_fields: sampleProvider ? Object.keys(sampleProvider) : null,
            sample_provider_data: sampleProvider,
            providers_with_is_bookable: {
                success: !allProvidersError,
                data: allProviders || null,
                error: allProvidersError?.message || null
            },
            bookable_table_check: {
                exists: !bookableError,
                error: bookableError?.message || null
            },
            bookable_providers_table_check: {
                exists: !bookableProvidersError,
                error: bookableProvidersError?.message || null
            },
            analysis: {
                has_is_bookable_field: sampleProvider ? 'is_bookable' in sampleProvider : false,
                has_accepts_new_patients_field: sampleProvider ? 'accepts_new_patients' in sampleProvider : false,
                separate_bookable_table_exists: !bookableError,
                separate_bookable_providers_table_exists: !bookableProvidersError
            }
        }

        console.log('✅ Schema check complete')
        
        return NextResponse.json(response)

    } catch (error: any) {
        console.error('💥 Error checking schema:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message 
        }, { status: 500 })
    }
}
import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Starting API diagnostics...')
        
        // Test 1: Check provider data
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, title, role, is_active')
            .eq('is_active', true)
        
        console.log('👥 Providers:', providers?.length || 0, providersError)
        
        // Test 2: Check provider availability data
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .limit(10)
        
        console.log('📅 Provider availability records:', availability?.length || 0, availabilityError)
        
        // Test 3: Check provider-payer relationships
        const { data: relationships, error: relationshipsError } = await supabase
            .from('provider_payer_networks')
            .select('*')
            .eq('status', 'active')
            .limit(10)
        
        console.log('🔗 Provider-payer relationships:', relationships?.length || 0, relationshipsError)
        
        // Test 4: Check payers
        const { data: payers, error: payersError } = await supabase
            .from('payers')
            .select('id, name, effective_date')
            .limit(5)
        
        console.log('🏥 Payers:', payers?.length || 0, payersError)

        return NextResponse.json({
            success: true,
            diagnostics: {
                providers: {
                    count: providers?.length || 0,
                    data: providers,
                    error: providersError
                },
                availability: {
                    count: availability?.length || 0,
                    data: availability,
                    error: availabilityError
                },
                relationships: {
                    count: relationships?.length || 0,
                    data: relationships,
                    error: relationshipsError
                },
                payers: {
                    count: payers?.length || 0,
                    data: payers,
                    error: payersError
                }
            }
        })

    } catch (error) {
        console.error('💥 Diagnostics error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
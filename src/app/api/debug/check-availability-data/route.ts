import { supabase, supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('🔍 Checking provider availability data...')
        
        // Check provider_availability table (using admin client for RLS access)
        const { data: availability, error: availabilityError } = await supabaseAdmin
            .from('provider_availability')
            .select('*')
            .limit(10)
        
        if (availabilityError) {
            console.error('❌ Error checking provider_availability:', availabilityError)
        }
        
        // Check providers table
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, is_active, intakeq_practitioner_id')
            .eq('is_active', true)
            .limit(10)
        
        if (providersError) {
            console.error('❌ Error checking providers:', providersError)
        }
        
        // Check provider_payer_networks table
        const { data: networks, error: networksError } = await supabase
            .from('provider_payer_networks')
            .select('provider_id, payer_id, status')
            .eq('status', 'in_network')
            .limit(10)
        
        if (networksError) {
            console.error('❌ Error checking networks:', networksError)
        }
        
        // Check if there are any old provider_availability_cache records
        const { data: cache, error: cacheError } = await supabase
            .from('provider_availability_cache')
            .select('*')
            .limit(5)
        
        console.log('📊 Data summary:')
        console.log(`- provider_availability records: ${availability?.length || 0}`)
        console.log(`- active providers: ${providers?.length || 0}`)
        console.log(`- provider networks: ${networks?.length || 0}`)
        console.log(`- availability cache: ${cache?.length || 0}`)
        
        return NextResponse.json({
            success: true,
            data: {
                provider_availability: {
                    count: availability?.length || 0,
                    sample: availability?.[0] || null,
                    error: availabilityError
                },
                providers: {
                    count: providers?.length || 0,
                    sample: providers?.[0] || null,
                    error: providersError
                },
                provider_networks: {
                    count: networks?.length || 0,
                    sample: networks?.[0] || null,
                    error: networksError
                },
                availability_cache: {
                    count: cache?.length || 0,
                    sample: cache?.[0] || null,
                    error: cacheError
                }
            }
        })
        
    } catch (error: any) {
        console.error('💥 Error in debug check:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
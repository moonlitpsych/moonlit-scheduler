// src/app/api/diagnostics/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        console.log('🔍 Starting Enhanced API diagnostics...')
        
        // Test 1: Check provider data
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, title, role, is_active')
            .eq('is_active', true)
        
        console.log('👥 Active Providers:', providers?.length || 0, providersError)
        
        // Test 2: Check provider availability data
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .limit(25)
        
        console.log('📅 Provider availability records:', availability?.length || 0, availabilityError)
        
        // Test 3: Check provider-payer relationships (CORRECT TABLE NAME)
        const { data: relationships, error: relationshipsError } = await supabase
            .from('provider_payer_networks')
            .select('*')
            .eq('status', 'active')
        
        console.log('🔗 Provider-payer networks (all active):', relationships?.length || 0, relationshipsError)
        
        // Test 4: Check all payers
        const { data: payers, error: payersError } = await supabase
            .from('payers')
            .select('id, name, effective_date, payer_type, requires_attending, status_code')
        
        console.log('🏥 All Payers:', payers?.length || 0, payersError)

        // Test 5: Check DMBA payer specifically
        const { data: dmbaPayers, error: dmbaError } = await supabase
            .from('payers')
            .select('*')
            .or('name.ilike.%dmba%,name.ilike.%molina%')
        
        console.log('🎯 DMBA/Molina payers:', dmbaPayers?.length || 0, dmbaError)

        // Test 6: Check Travis specifically with his relationships
        const travisId = '35ab086b-2894-446d-9ab5-3d41613017ad'
        const { data: travisNetworks, error: travisError } = await supabase
            .from('provider_payer_networks')
            .select(`
                *,
                providers!inner(first_name, last_name),
                payers!inner(name, payer_type)
            `)
            .eq('provider_id', travisId)
            .eq('status', 'active')
        
        console.log('👨‍⚕️ Travis networks:', travisNetworks?.length || 0, travisError)

        // Test 7: Check DMBA specifically for Travis
        const dmbaId = '8bd0bedb-226e-4253-bfeb-46ce835ef2a8'
        const { data: travisDmba, error: travisDmbaError } = await supabase
            .from('provider_payer_networks')
            .select('*')
            .eq('provider_id', travisId)
            .eq('payer_id', dmbaId)
            .eq('status', 'active')
        
        console.log('🎯 Travis-DMBA specific relationship:', travisDmba?.length || 0, travisDmbaError)

        // Test 8: Check Travis availability on Sunday (day_of_week = 0)
        const { data: travisSunday, error: travisSundayError } = await supabase
            .from('provider_availability')
            .select('*')
            .eq('provider_id', travisId)
            .eq('day_of_week', 0)
        
        console.log('☀️ Travis Sunday availability:', travisSunday?.length || 0, travisSundayError)

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
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
                },
                dmba_molina_payers: {
                    count: dmbaPayers?.length || 0,
                    data: dmbaPayers,
                    error: dmbaError
                },
                travis_networks: {
                    count: travisNetworks?.length || 0,
                    data: travisNetworks,
                    error: travisError
                },
                travis_dmba_relationship: {
                    count: travisDmba?.length || 0,
                    data: travisDmba,
                    error: travisDmbaError
                },
                travis_sunday_availability: {
                    count: travisSunday?.length || 0,
                    data: travisSunday,
                    error: travisSundayError
                }
            },
            summary: {
                total_providers: providers?.length || 0,
                total_availability_records: availability?.length || 0,
                total_relationships: relationships?.length || 0,
                total_payers: payers?.length || 0,
                dmba_found: dmbaPayers?.length || 0,
                travis_networks_found: travisNetworks?.length || 0,
                travis_dmba_direct: travisDmba?.length || 0,
                travis_sunday_slots: travisSunday?.length || 0
            }
        })

    } catch (error) {
        console.error('💥 Enhanced diagnostics error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
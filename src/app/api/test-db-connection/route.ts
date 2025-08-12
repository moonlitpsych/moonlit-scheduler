import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })

        // Test 1: Basic connection
        const { data: connectionTest, error: connectionError } = await supabase
            .from('providers')
            .select('count')
            .limit(1)

        // Test 2: Get providers count
        const { count: providersCount, error: providersCountError } = await supabase
            .from('providers')
            .select('*', { count: 'exact', head: true })

        // Test 3: Get payers count  
        const { count: payersCount, error: payersCountError } = await supabase
            .from('payers')
            .select('*', { count: 'exact', head: true })

        // Test 4: Check provider_availability table
        const { count: availabilityCount, error: availabilityCountError } = await supabase
            .from('provider_availability')
            .select('*', { count: 'exact', head: true })

        // Test 5: Check Travis specifically
        const travisAuthId = '35428fe4-24d1-4935-acd5-aecc3dd3e430'
        const { data: travisRecords, error: travisError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, email, auth_user_id')
            .eq('auth_user_id', travisAuthId)

        // Test 6: Check if there are multiple Travis records
        const { data: allTravisRecords, error: allTravisError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, email, auth_user_id')
            .ilike('email', '%travis.norseth%')

        // Test 7: Sample payers for testing
        const { data: samplePayers, error: samplePayersError } = await supabase
            .from('payers')
            .select('id, name')
            .limit(3)

        // Test 8: Provider-payer relationships  
        const { count: relationshipsCount, error: relationshipsError } = await supabase
            .from('provider_payer_relationships')
            .select('*', { count: 'exact', head: true })

        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            tests: {
                connection: {
                    success: !connectionError,
                    error: connectionError?.message
                },
                providerCount: {
                    count: providersCount,
                    error: providersCountError?.message
                },
                payerCount: {
                    count: payersCount,
                    error: payersCountError?.message
                },
                availabilityCount: {
                    count: availabilityCount,
                    error: availabilityCountError?.message
                },
                travisLookup: {
                    recordsFound: travisRecords?.length || 0,
                    records: travisRecords,
                    error: travisError?.message
                },
                allTravisRecords: {
                    recordsFound: allTravisRecords?.length || 0,
                    records: allTravisRecords,
                    error: allTravisError?.message
                },
                samplePayers: {
                    payers: samplePayers,
                    error: samplePayersError?.message
                },
                relationshipsCount: {
                    count: relationshipsCount,
                    error: relationshipsError?.message
                }
            },
            summary: {
                hasProviders: (providersCount || 0) > 0,
                hasPayers: (payersCount || 0) > 0,
                hasAvailability: (availabilityCount || 0) > 0,
                hasRelationships: (relationshipsCount || 0) > 0,
                travisFound: (travisRecords?.length || 0) > 0
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Database test failed:', error)
        return NextResponse.json(
            { 
                success: false,
                error: error.message,
                details: error.stack
            },
            { status: 500 }
        )
    }
}
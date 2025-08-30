// Test API to debug license data fetching
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Test 1: Direct query of provider_licenses table
        const { data: licenses, error: licensesError } = await supabase
            .from('provider_licenses')
            .select('*')
            .limit(5)

        // Test 2: Query providers with licenses
        const { data: providersWithLicenses, error: providersError } = await supabase
            .from('providers')
            .select(`
                id,
                first_name,
                last_name,
                provider_licenses(
                    license_type,
                    issuing_state
                )
            `)
            .limit(3)

        return NextResponse.json({
            success: true,
            tests: {
                direct_licenses: {
                    data: licenses,
                    error: licensesError
                },
                providers_with_licenses: {
                    data: providersWithLicenses,
                    error: providersError
                }
            }
        })

    } catch (error: any) {
        console.error('❌ License test error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to test license data', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}
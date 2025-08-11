// src/app/api/patient-booking/providers-for-payer/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { payerId } = await request.json()

        console.log(`Getting providers for payer ${payerId || 'test-payer'}`)

        const supabase = createRouteHandlerClient({ cookies })

        // For now, get all available providers since we don't have provider-payer relationships fully set up
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, first_name, last_name, title, role, availability, accepts_new_patients, telehealth_enabled')
            .eq('availability', true)

        if (providersError) {
            console.error('Error getting providers:', providersError)
            return NextResponse.json(
                { 
                    error: 'Failed to get providers', 
                    details: providersError.message,
                    success: false 
                },
                { status: 500 }
            )
        }

        // Filter to only available providers
        const availableProviders = (providers || []).filter(p => p.availability === true)

        const response = {
            success: true,
            data: {
                payerId: payerId || 'test-payer',
                providers: availableProviders,
                totalProviders: availableProviders.length,
                message: availableProviders.length > 0 
                    ? `Found ${availableProviders.length} providers who are available for appointments`
                    : 'No providers found. Please ensure providers have availability=true in the database.'
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error getting providers for payer:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get providers', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}
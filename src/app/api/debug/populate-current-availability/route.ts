// Debug endpoint to populate provider_availability_cache with current availability data for testing

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        console.log('🏥 Populating current availability for testing slot function...')

        const results = {
            providers_updated: [],
            errors: []
        }

        // Get current bookable providers
        const { data: bookableProviders, error: providersError } = await supabaseAdmin
            .from('providers')
            .select('id, first_name, last_name')
            .eq('is_bookable', true)

        if (providersError) {
            throw new Error(`Failed to get bookable providers: ${providersError.message}`)
        }

        // Service instance ID from debug tests
        const serviceInstanceId = 'ac8a10fa-443e-4913-93d3-26c0307beb96'
        
        // Generate dates for next 14 days
        const startDate = new Date()
        const dates = []
        for (let i = 0; i < 14; i++) {
            const date = new Date(startDate)
            date.setDate(startDate.getDate() + i)
            dates.push(date.toISOString().split('T')[0])
        }

        // Generate sample availability slots for each provider and date
        const generateSampleSlots = (date: string) => [
            {
                start_time: `${date} 09:00:00`,
                end_time: `${date} 10:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            },
            {
                start_time: `${date} 10:00:00`,
                end_time: `${date} 11:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            },
            {
                start_time: `${date} 11:00:00`,
                end_time: `${date} 12:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            },
            {
                start_time: `${date} 14:00:00`,
                end_time: `${date} 15:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            },
            {
                start_time: `${date} 15:00:00`,
                end_time: `${date} 16:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            },
            {
                start_time: `${date} 16:00:00`,
                end_time: `${date} 17:00:00`,
                appointment_type: 'telehealth',
                duration_minutes: 60,
                available: true
            }
        ]

        // Create availability records for each provider
        for (const provider of bookableProviders) {
            console.log(`📅 Creating availability for ${provider.first_name} ${provider.last_name}...`)
            
            const providerSlots = []
            for (const date of dates) {
                // Skip weekends for realistic scheduling
                const dayOfWeek = new Date(date).getDay()
                if (dayOfWeek === 0 || dayOfWeek === 6) continue

                const availabilityRecord = {
                    id: crypto.randomUUID(),
                    provider_id: provider.id,
                    service_instance_id: serviceInstanceId,
                    date: date,
                    available_slots: generateSampleSlots(date),
                    last_synced_athena: new Date().toISOString(),
                    created_at: new Date().toISOString()
                }

                providerSlots.push(availabilityRecord)
            }

            // Insert availability for this provider
            const { error: insertError } = await supabaseAdmin
                .from('provider_availability_cache')
                .insert(providerSlots)

            if (insertError) {
                results.errors.push(`Error creating availability for ${provider.first_name}: ${insertError.message}`)
            } else {
                results.providers_updated.push({
                    provider_name: `${provider.first_name} ${provider.last_name}`,
                    provider_id: provider.id,
                    slots_created: providerSlots.length,
                    date_range: `${dates[0]} to ${dates[dates.length - 1]}`
                })
                console.log(`✅ Created ${providerSlots.length} availability records for ${provider.first_name}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Current availability populated successfully',
            results,
            test_instructions: [
                "1. Now test the slot function: GET /api/debug/test-slot-function",
                "2. If working, the function should return available slots",
                "3. Test merged-availability API with current dates",
                "4. Check booking flow with populated availability"
            ]
        })

    } catch (error: any) {
        console.error('❌ Availability population error:', error)
        return NextResponse.json(
            { success: false, error: 'Population failed', details: error.message },
            { status: 500 }
        )
    }
}
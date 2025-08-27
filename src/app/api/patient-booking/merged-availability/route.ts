// src/app/api/patient-booking/merged-availability/route.ts
import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface AvailableSlot {
    date: string
    time: string
    providerId: string
    providerName: string
    duration: number
    isAvailable: boolean
    provider: {
        id: string
        first_name: string
        last_name: string
        title: string
        role: string
    }
}

export async function POST(request: NextRequest) {
    try {
        const { payer_id, date, startDate, endDate, appointmentDuration = 60, provider_id } = await request.json()

        // Support both single date and date range requests
        const requestDate = date || startDate
        const requestEndDate = endDate || date

        if (!payer_id || !requestDate) {
            return NextResponse.json(
                { error: 'payer_id and date are required', success: false },
                { status: 400 }
            )
        }

        console.log(`🔍 Getting ${provider_id ? 'provider-specific' : 'merged'} availability for payer ${payer_id} on ${requestDate}${provider_id ? ` (provider: ${provider_id})` : ''}`)

        // Step 1: Get providers who accept this payer using CORRECT table name
        let query = supabase
            .from('provider_payer_networks')
            .select(`
                provider_id,
                effective_date,
                status,
                providers!inner (
                    id,
                    first_name,
                    last_name,
                    title,
                    role,
                    is_active,
                    accepts_new_patients,
                    telehealth_enabled
                )
            `)
            .eq('payer_id', payer_id)
            .eq('status', 'in_network')
            .eq('providers.is_active', true)

        // If provider_id is specified, filter for that specific provider
        if (provider_id) {
            query = query.eq('provider_id', provider_id)
        }

        const { data: networks, error: networksError } = await query

        if (networksError) {
            console.error('❌ Error fetching provider networks:', networksError)
            return NextResponse.json(
                { error: 'Failed to fetch provider networks', details: networksError, success: false },
                { status: 500 }
            )
        }

        const providers = networks?.map(n => n.providers) || []
        const providerIds = providers.map(p => p.id)
        
        console.log(`👥 Found ${providers.length} providers accepting this payer:`, 
            providers.map(p => `${p.first_name} ${p.last_name}`))

        if (providers.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    totalSlots: 0,
                    availableSlots: [],
                    dateRange: { startDate: requestDate, endDate: requestEndDate },
                    message: 'No providers currently accept this insurance'
                }
            })
        }

        // Step 2: Convert date to day of week (0 = Sunday, 1 = Monday, etc.)
        const targetDate = new Date(requestDate)
        const dayOfWeek = targetDate.getDay()
        console.log(`📅 Target date ${requestDate} is day of week ${dayOfWeek} (0=Sun, 1=Mon, etc.)`)

        // Step 3: Get availability for these providers on this day of week
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .in('provider_id', providerIds)
            .eq('day_of_week', dayOfWeek)
            .eq('is_recurring', true)

        if (availabilityError) {
            console.error('❌ Error fetching availability:', availabilityError)
            return NextResponse.json(
                { error: 'Failed to fetch availability', details: availabilityError, success: false },
                { status: 500 }
            )
        }

        console.log(`📊 Found ${availability?.length || 0} availability records`)

        // Step 4: Generate time slots from availability
        const allSlots: AvailableSlot[] = []
        
        availability?.forEach(avail => {
            const provider = providers.find(p => p.id === avail.provider_id)
            if (!provider) return

            console.log(`⏰ Processing availability for ${provider.first_name} ${provider.last_name}: ${avail.start_time} - ${avail.end_time}`)

            const slots = generateTimeSlotsFromAvailability(avail, requestDate, provider, appointmentDuration)
            allSlots.push(...slots)
        })

        // Sort by time
        allSlots.sort((a, b) => a.time.localeCompare(b.time))

        console.log(`✅ Generated ${allSlots.length} total time slots`)

        // Group slots by date for easier frontend consumption
        const slotsByDate = allSlots.reduce((acc, slot) => {
            if (!acc[slot.date]) {
                acc[slot.date] = []
            }
            acc[slot.date].push(slot)
            return acc
        }, {} as Record<string, AvailableSlot[]>)

        const response = {
            success: true,
            data: {
                totalSlots: allSlots.length,
                dateRange: { startDate: requestDate, endDate: requestEndDate },
                slotsByDate,
                availableSlots: allSlots.slice(0, 50), // Limit for performance
                providers: providers.map(p => ({
                    id: p.id,
                    name: `${p.first_name} ${p.last_name}`,
                    title: p.title,
                    role: p.role
                })),
                debug: {
                    payer_id,
                    date: requestDate,
                    dayOfWeek,
                    providers_found: providers.length,
                    availability_records: availability?.length || 0,
                    slots_generated: allSlots.length
                },
                message: `Found ${allSlots.length} available appointment slots from ${providers.length} providers`
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('💥 Error getting merged availability:', error)
        return NextResponse.json(
            { 
                error: 'Failed to get availability', 
                details: error.message,
                success: false 
            },
            { status: 500 }
        )
    }
}

function generateTimeSlotsFromAvailability(
    availability: any, 
    date: string, 
    provider: any, 
    appointmentDuration: number
): AvailableSlot[] {
    const slots: AvailableSlot[] = []
    
    try {
        const startTime = availability.start_time // e.g., "09:00:00"
        const endTime = availability.end_time     // e.g., "17:00:00"
        
        // Parse start and end times
        const [startHour, startMin] = startTime.split(':').map(Number)
        const [endHour, endMin] = endTime.split(':').map(Number)
        
        // Create date objects for this specific date
        const baseDate = new Date(date)
        let currentTime = new Date(baseDate)
        currentTime.setHours(startHour, startMin, 0, 0)
        
        const endDateTime = new Date(baseDate)
        endDateTime.setHours(endHour, endMin, 0, 0)
        
        // Generate slots based on appointment duration
        while (currentTime < endDateTime) {
            const slotEndTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
            
            // Don't create slots that extend past the end time
            if (slotEndTime <= endDateTime) {
                slots.push({
                    date: date,
                    time: formatTime(currentTime),
                    providerId: availability.provider_id,
                    providerName: `${provider.first_name} ${provider.last_name}`,
                    duration: appointmentDuration,
                    isAvailable: true,
                    provider: {
                        id: provider.id,
                        first_name: provider.first_name,
                        last_name: provider.last_name,
                        title: provider.title || '',
                        role: provider.role || ''
                    }
                })
            }
            
            // Move to next slot (based on appointment duration)
            currentTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
        }
        
        console.log(`✅ Generated ${slots.length} slots for ${provider.first_name}`)
        
    } catch (error) {
        console.error('❌ Error generating time slots:', error)
    }
    
    return slots
}

function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5) // Returns "HH:MM"
}
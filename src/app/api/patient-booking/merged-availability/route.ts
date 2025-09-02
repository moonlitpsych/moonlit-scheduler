// src/app/api/patient-booking/merged-availability/route.ts
import { supabase } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
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

        // Step 1: Get payer info to determine which view to use
        const { data: payer, error: payerError } = await supabase
            .from('payers')
            .select('name, requires_attending, credentialing_status, effective_date')
            .eq('id', payer_id)
            .single()

        if (payerError || !payer) {
            console.error('❌ Error fetching payer info:', payerError)
            return NextResponse.json(
                { error: 'Payer not found', details: payerError, success: false },
                { status: 404 }
            )
        }

        console.log(`🔍 Payer: ${payer.name}, requires_attending: ${payer.requires_attending}`)

        // Use appropriate view based on payer credentialing model
        let providerData, dataError
        
        if (payer.requires_attending) {
            // Supervision model - use v_bookable_provider_payer
            console.log('📋 Using v_bookable_provider_payer (supervision model)')
            const { data, error } = await supabase
                .from('v_bookable_provider_payer')
                .select(`
                    provider_id,
                    payer_id,
                    effective_date,
                    network_status,
                    billing_provider_id,
                    rendering_provider_id,
                    show_in_widget,
                    earliest_appointment_date
                `)
                .eq('payer_id', payer_id)
                .eq('network_status', 'in_network')
                .eq('show_in_widget', true)
                .lte('earliest_appointment_date', requestDate)
            
            providerData = data
            dataError = error
        } else {
            // Direct credentialing - use v_in_network_bookable  
            console.log('📋 Using v_in_network_bookable (direct credentialing)')
            const { data, error } = await supabase
                .from('v_in_network_bookable')
                .select(`
                    provider_id,
                    payer_id,
                    effective_date,
                    status,
                    show_in_widget,
                    earliest_appointment_date
                `)
                .eq('payer_id', payer_id)
                .eq('status', 'in_network')
                .eq('show_in_widget', true)
                .lte('earliest_appointment_date', requestDate)
            
            providerData = data
            dataError = error
        }

        if (dataError) {
            console.error('❌ Error fetching provider relationships:', dataError)
            return NextResponse.json(
                { error: 'Failed to fetch provider relationships', details: dataError, success: false },
                { status: 500 }
            )
        }

        console.log(`🔗 Found ${providerData?.length || 0} provider relationships for ${payer.name}`)

        const networkProviderIds = providerData?.map(n => n.provider_id) || []
        console.log('🔍 Found provider IDs from view:', networkProviderIds)

        if (networkProviderIds.length === 0) {
            console.log('📋 No provider relationships found')
            return NextResponse.json({
                success: true,
                data: {
                    totalSlots: 0,
                    dateRange: { startDate: requestDate, endDate: requestEndDate },
                    slotsByDate: {},
                    availableSlots: [],
                    providers: [],
                    message: `${payer.name} found but no providers are bookable yet`
                }
            })
        }

        // Now get the actual provider details
        let query = supabase
            .from('providers')
            .select(`
                id,
                first_name,
                last_name,
                title,
                role
            `)
            .in('id', networkProviderIds)

        // If provider_id is specified, filter for that specific provider
        if (provider_id) {
            query = query.eq('id', provider_id)
        }

        const { data: providers, error: providersError } = await query

        if (providersError) {
            console.error('❌ Error fetching providers:', providersError)
            return NextResponse.json(
                { error: 'Failed to fetch providers', details: providersError, success: false },
                { status: 500 }
            )
        }
        
        console.log(`👥 Found ${providers?.length || 0} providers accepting this payer:`, 
            providers?.map(p => `${p.first_name} ${p.last_name}`) || [])

        if (!providers || providers.length === 0) {
            console.log('📋 No active providers found for this payer')
            return NextResponse.json({
                success: true,
                data: {
                    totalSlots: 0,
                    dateRange: { startDate: requestDate, endDate: requestEndDate },
                    slotsByDate: {},
                    availableSlots: [],
                    providers: [],
                    message: `No active providers found for ${payer.name}`
                }
            })
        }

        // Step 2: Convert date to day of week (0 = Sunday, 1 = Monday, etc.)
        const targetDate = new Date(requestDate)
        const dayOfWeek = targetDate.getDay()
        console.log(`📅 Target date ${requestDate} is day of week ${dayOfWeek} (0=Sun, 1=Mon, etc.)`)

        // Step 3: Get availability for these providers on this day of week
        const providerIds = providers.map(p => p.id)
        
        // Debug: Check what availability exists for these providers (all days)
        const { data: allAvail, error: debugError } = await supabase
            .from('provider_availability')
            .select('provider_id, day_of_week, start_time, end_time, effective_date, expiration_date')
            .in('provider_id', providerIds)
            .limit(10)
        
        // Also check what provider IDs actually exist in provider_availability
        const { data: allProviderIds, error: providerIdsError } = await supabase
            .from('provider_availability')
            .select('provider_id')
            .limit(10)
        
        // Check if data exists in provider_availability_cache instead
        const { data: cacheData, error: cacheError } = await supabase
            .from('provider_availability_cache')
            .select('provider_id, date, available_slots')
            .in('provider_id', providerIds)
            .limit(5)
        
        console.log(`🔍 Debug: All availability for these providers:`, allAvail)
        console.log(`🔍 Debug: Sample provider IDs in provider_availability table:`, allProviderIds?.map(p => p.provider_id))
        console.log(`🔍 Debug: Cache data for these providers:`, cacheData)
        console.log(`🔍 Debug: Looking for provider IDs:`, providerIds)
        console.log(`🔍 Debug: Looking for day_of_week = ${dayOfWeek} on date ${requestDate}`)
        
        // Query provider_availability table directly since ScheduleEditor writes there
        const { data: availability, error: availabilityError } = await supabase
            .from('provider_availability')
            .select('*')
            .in('provider_id', providerIds)
            .eq('day_of_week', dayOfWeek)
            .lte('effective_date', requestDate)
            .or('expiration_date.is.null,expiration_date.gte.' + requestDate)

        if (availabilityError) {
            console.error('❌ Error fetching availability:', availabilityError)
            return NextResponse.json(
                { error: 'Failed to fetch availability', details: availabilityError, success: false },
                { status: 500 }
            )
        }

        console.log(`📊 Found ${availability?.length || 0} availability records`)

        // Step 4: Generate time slots from availability OR use defaults if no availability exists
        let allSlots: AvailableSlot[] = []
        
        if (availability && availability.length > 0) {
            // Use actual availability records from provider_availability table
            availability.forEach(avail => {
                const provider = providers.find(p => p.id === avail.provider_id)
                if (!provider) return

                console.log(`⏰ Processing availability for ${provider.first_name} ${provider.last_name}: ${avail.start_time} - ${avail.end_time}`)

                const slots = generateTimeSlotsFromAvailability(avail, requestDate, provider, appointmentDuration)
                allSlots.push(...slots)
            })
        } else {
            // No availability records found - this indicates providers haven't set their schedules
            console.log('📅 No availability records found in provider_availability table')
            allSlots = []
        }

        // Sort by time
        allSlots.sort((a, b) => a.time.localeCompare(b.time))

        console.log(`✅ Found ${allSlots.length} total time slots from ${availability?.length || 0} availability records`)

        // Step 5: Filter out slots that conflict with existing IntakeQ appointments
        const filteredSlots = await filterConflictingAppointments(allSlots, requestDate)
        
        console.log(`🔍 After filtering conflicts: ${filteredSlots.length} available slots (removed ${allSlots.length - filteredSlots.length} conflicts)`)

        // Group filtered slots by date for easier frontend consumption
        const slotsByDate = filteredSlots.reduce((acc, slot) => {
            if (!acc[slot.date]) {
                acc[slot.date] = []
            }
            acc[slot.date].push(slot)
            return acc
        }, {} as Record<string, AvailableSlot[]>)

        const response = {
            success: true,
            data: {
                totalSlots: filteredSlots.length,
                dateRange: { startDate: requestDate, endDate: requestEndDate },
                slotsByDate,
                availableSlots: filteredSlots.slice(0, 50), // Limit for performance
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
                message: allSlots.length > 0 
                    ? `Found ${allSlots.length} available appointment slots from ${providers.length} providers`
                    : `Found ${providers.length} providers accepting this insurance, but no availability schedules configured`
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

async function filterConflictingAppointments(slots: AvailableSlot[], date: string): Promise<AvailableSlot[]> {
    console.log(`🔍 Checking for appointment conflicts on ${date}...`)
    
    // Group slots by provider to minimize API calls
    const slotsByProvider = slots.reduce((acc, slot) => {
        const providerId = slot.providerId
        if (!acc[providerId]) {
            acc[providerId] = []
        }
        acc[providerId].push(slot)
        return acc
    }, {} as Record<string, AvailableSlot[]>)

    const filteredSlots: AvailableSlot[] = []
    
    for (const [providerId, providerSlots] of Object.entries(slotsByProvider)) {
        try {
            // Get provider's IntakeQ practitioner ID from the first slot
            // We'll need to look this up from the database
            const { data: provider, error } = await supabase
                .from('providers')
                .select('intakeq_practitioner_id')
                .eq('id', providerId)
                .single()

            if (error || !provider?.intakeq_practitioner_id) {
                console.log(`⚠️ No IntakeQ practitioner ID for provider ${providerId}, skipping conflict check`)
                // Add all slots for this provider if no IntakeQ mapping
                filteredSlots.push(...providerSlots)
                continue
            }

            // Get existing appointments for this practitioner on this date
            const existingAppointments = await intakeQService.getAppointmentsForDate(
                provider.intakeq_practitioner_id, 
                date
            )

            console.log(`📅 Provider ${providerId} has ${existingAppointments.length} existing appointments`)

            // Filter out slots that conflict with existing appointments
            const availableSlots = providerSlots.filter(slot => {
                const slotStartTime = new Date(`${slot.date}T${slot.time}:00`).getTime()
                
                // Check if this slot conflicts with any existing appointment
                const hasConflict = existingAppointments.some(appointment => {
                    const appointmentStart = new Date(appointment.StartDate)
                    const appointmentEnd = new Date(appointment.EndDate || (appointment.StartDate + 60 * 60 * 1000)) // Use EndDate or assume 60min
                    
                    const slotStart = new Date(slotStartTime)
                    const slotEnd = new Date(slotStartTime + 60 * 60 * 1000) // Assume 60min slots
                    
                    // Check for overlap
                    return (slotStart < appointmentEnd && slotEnd > appointmentStart)
                })
                
                if (hasConflict) {
                    console.log(`⚠️ Slot ${slot.time} conflicts with existing appointment, removing`)
                }
                
                return !hasConflict
            })

            filteredSlots.push(...availableSlots)
            console.log(`✅ Provider ${providerId}: ${availableSlots.length}/${providerSlots.length} slots available`)

        } catch (error: any) {
            console.error(`❌ Error checking conflicts for provider ${providerId}:`, error.message)
            // Add all slots if conflict check fails
            filteredSlots.push(...providerSlots)
        }
    }
    
    return filteredSlots
}

// Note: Removed fake default availability generation
// System now properly surfaces when real provider schedules are missing
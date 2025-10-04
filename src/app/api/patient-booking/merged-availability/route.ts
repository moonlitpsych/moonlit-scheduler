// IMPROVED VERSION: Uses v_bookable_provider_payer view and co-visit logic
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { coVisitService } from '@/lib/services/coVisitService'
import { BookableProviderPayer } from '@/types/database'
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
    // NEW: Co-visit support
    isCoVisit?: boolean
    attendingProviderId?: string
    attendingName?: string
    supervisionLevel?: 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required'
}

export async function POST(request: NextRequest) {
    try {
        const { payer_id, date, startDate, endDate, appointmentDuration = 60, provider_id } = await request.json()

        const requestDate = date || startDate
        const requestEndDate = endDate || date

        if (!payer_id || !requestDate) {
            return NextResponse.json(
                { error: 'payer_id and date are required', success: false },
                { status: 400 }
            )
        }

        console.log(`🔍 Getting ${provider_id ? 'provider-specific' : 'merged'} availability for payer ${payer_id} on ${requestDate}${provider_id ? ` (provider: ${provider_id})` : ''}`)

        // Step 1: Get BOOKABLE providers using canonical view (consistent with providers-for-payer API)
        const { data: bookableRelationships, error: networkError } = await supabaseAdmin
            .from('v_bookable_provider_payer')
            .select('*')
            .eq('payer_id', payer_id)

        if (networkError) {
            console.error('❌ Error fetching bookable provider relationships:', networkError)
            return NextResponse.json(
                { error: 'Failed to fetch bookable provider relationships', details: networkError, success: false },
                { status: 500 }
            )
        }

        // Transform canonical view data to expected format
        const bookableProviders = bookableRelationships?.map(rel => ({
            provider_id: rel.provider_id,
            payer_id: rel.payer_id,
            via: rel.network_status === 'in_network' ? 'direct' : 'supervised',
            attending_provider_id: rel.billing_provider_id,
            supervision_level: rel.network_status === 'supervised' ? 'standard' : null,
            requires_co_visit: false, // Not modeled in new view
            effective: true,
            bookable_from_date: rel.effective_date,
            first_name: rel.first_name,
            last_name: rel.last_name,
            title: rel.title,
            role: rel.role,
            provider_type: rel.provider_type,
            is_active: rel.is_active,
            is_bookable: rel.is_bookable
        })) || []

        if (provider_id) {
            const filtered = bookableProviders.filter(bp => bp.provider_id === provider_id)
            bookableProviders.length = 0
            bookableProviders.push(...filtered)
        }

        if (!bookableProviders || bookableProviders.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    totalSlots: 0,
                    availableSlots: [],
                    dateRange: { startDate: requestDate, endDate: requestEndDate },
                    message: 'No bookable providers currently accept this insurance'
                }
            })
        }

        const providerIds = bookableProviders.map(bp => bp.provider_id)
        console.log(`👥 NEW: Found ${bookableProviders.length} BOOKABLE providers from fallback logic:`, 
            bookableProviders.map(bp => `${bp.first_name} ${bp.last_name} (via: ${bp.via}, co-visit: ${bp.requires_co_visit})`))

        // Separate providers that need co-visit from regular providers
        const coVisitProviders = bookableProviders.filter(bp => bp.requires_co_visit)
        const regularProviders = bookableProviders.filter(bp => !bp.requires_co_visit)
        
        console.log(`🔄 Provider breakdown: ${regularProviders.length} regular, ${coVisitProviders.length} co-visit required`)

        const targetDate = new Date(requestDate)
        const dayOfWeek = targetDate.getDay()
        console.log(`📅 Target date ${requestDate} is day of week ${dayOfWeek} (0=Sun, 1=Mon, etc.)`)

        // Step 2: Get base availability for ONLY these bookable providers
        // CRITICAL: Filter by bookable providers to exclude Doug Sirutis and other non-bookable providers
        const { data: allProviders } = await supabaseAdmin
            .from('providers')
            .select('id')
            .eq('is_bookable', true)
            .not('intakeq_practitioner_id', 'is', null)

        const bookableProviderIds = allProviders?.map(p => p.id) || []
        const filteredProviderIds = providerIds.filter(id => bookableProviderIds.includes(id))

        console.log(`🔒 Filtered providers: ${providerIds.length} → ${filteredProviderIds.length} bookable`)

        const { data: availability, error: availabilityError } = await supabaseAdmin
            .from('provider_availability')
            .select('*')
            .in('provider_id', filteredProviderIds) // Only query BOOKABLE providers in payer network
            .eq('day_of_week', dayOfWeek)
            .eq('is_recurring', true)

        if (availabilityError) {
            console.error('❌ Error fetching availability:', availabilityError)
            return NextResponse.json(
                { error: 'Failed to fetch availability', details: availabilityError, success: false },
                { status: 500 }
            )
        }

        console.log(`📊 Found ${availability?.length || 0} base availability records for bookable providers`)
        
        // Step 3: Get exceptions for this specific date
        const { data: exceptions, error: exceptionsError } = await supabaseAdmin
            .from('availability_exceptions')
            .select('*')
            .in('provider_id', providerIds)
            .eq('exception_date', requestDate)

        if (exceptionsError) {
            console.log(`⚠️ Error fetching exceptions (non-critical):`, exceptionsError)
        }

        console.log(`🚫 Found ${exceptions?.length || 0} exceptions for ${requestDate}`)

        // Step 4: Apply exceptions to filter out unavailable slots
        const filteredAvailability = availability?.filter(avail => {
            // Check if this availability is cancelled by an exception
            const hasException = exceptions?.some(exception => 
                exception.provider_id === avail.provider_id &&
                exception.exception_type === 'unavailable' &&
                (
                    // Full day exception
                    (!exception.start_time && !exception.end_time) ||
                    // Time range exception that overlaps with availability
                    (exception.start_time && exception.end_time && 
                     exception.start_time <= avail.end_time && 
                     exception.end_time >= avail.start_time)
                )
            )
            
            if (hasException) {
                const provider = bookableProviders.find(p => p.provider_id === avail.provider_id)
                console.log(`🚫 Filtered out availability for ${provider?.first_name} ${provider?.last_name} due to exception`)
            }
            
            return !hasException
        }) || []

        console.log(`📊 After applying exceptions: ${filteredAvailability.length} availability records`)

        // Step 5: Generate time slots (regular + co-visit)
        const allSlots: AvailableSlot[] = []
        
        // Process regular providers
        for (const avail of filteredAvailability || []) {
            const provider = regularProviders.find(bp => bp.provider_id === avail.provider_id)
            if (!provider) continue

            console.log(`⏰ Regular provider ${provider.first_name} ${provider.last_name}: ${avail.start_time} - ${avail.end_time}`)
            
            const slots = generateTimeSlotsFromAvailability(avail, requestDate, {
                id: provider.provider_id,
                first_name: provider.first_name || '',
                last_name: provider.last_name || '',
                title: provider.title || 'MD',
                role: provider.role || 'physician'
            }, appointmentDuration)
            allSlots.push(...slots)
        }

        // Process co-visit providers
        for (const coVisitProvider of coVisitProviders) {
            if (!coVisitProvider.attending_provider_id) {
                console.warn(`⚠️ Co-visit provider ${coVisitProvider.first_name} ${coVisitProvider.last_name} missing attending_provider_id`)
                continue
            }

            console.log(`🤝 Processing co-visit for resident ${coVisitProvider.first_name} ${coVisitProvider.last_name} with attending ${coVisitProvider.attending_provider_id}`)
            
            try {
                const coVisitSlots = await coVisitService.getCoVisitAvailability(
                    coVisitProvider.provider_id,
                    coVisitProvider.attending_provider_id,
                    requestDate,
                    appointmentDuration
                )

                // Convert co-visit slots to AvailableSlot format
                const convertedSlots = coVisitSlots.map(cvSlot => ({
                    date: requestDate,
                    time: new Date(cvSlot.start_time).toTimeString().slice(0, 5),
                    providerId: cvSlot.resident_provider_id,
                    providerName: `${coVisitProvider.first_name} ${coVisitProvider.last_name} (with ${cvSlot.attending_name})`,
                    duration: appointmentDuration,
                    isAvailable: true,
                    provider: {
                        id: coVisitProvider.provider_id,
                        first_name: coVisitProvider.first_name || '',
                        last_name: coVisitProvider.last_name || '',
                        title: coVisitProvider.title || 'MD',
                        role: coVisitProvider.role || 'physician'
                    },
                    // NEW: Co-visit specific metadata
                    isCoVisit: true,
                    attendingProviderId: cvSlot.attending_provider_id,
                    attendingName: cvSlot.attending_name,
                    supervisionLevel: coVisitProvider.supervision_level
                }))

                allSlots.push(...convertedSlots)
                console.log(`✅ Added ${convertedSlots.length} co-visit slots for ${coVisitProvider.first_name} ${coVisitProvider.last_name}`)
            } catch (error) {
                console.error(`❌ Error processing co-visit for ${coVisitProvider.first_name} ${coVisitProvider.last_name}:`, error)
            }
        }

        allSlots.sort((a, b) => a.time.localeCompare(b.time))
        console.log(`✅ Generated ${allSlots.length} total time slots from bookable providers`)

        // Step 6: Filter out IntakeQ conflicts
        const finalSlots = await filterConflictingAppointments(allSlots, requestDate)
        
        console.log(`🔍 Final result: ${finalSlots.length} available slots (removed ${allSlots.length - finalSlots.length} conflicts)`)

        const slotsByDate = finalSlots.reduce((acc, slot) => {
            if (!acc[slot.date]) {
                acc[slot.date] = []
            }
            acc[slot.date].push(slot)
            return acc
        }, {} as Record<string, AvailableSlot[]>)

        const response = {
            success: true,
            data: {
                totalSlots: finalSlots.length,
                dateRange: { startDate: requestDate, endDate: requestEndDate },
                slotsByDate,
                availableSlots: finalSlots.slice(0, 50),
                providers: bookableProviders.map(bp => ({
                    id: bp.provider_id,
                    name: `${bp.first_name} ${bp.last_name}`,
                    title: bp.title,
                    role: bp.role,
                    is_bookable: bp.is_bookable,
                    via: bp.via,
                    requires_co_visit: bp.requires_co_visit,
                    supervision_level: bp.supervision_level,
                    attending_provider_id: bp.attending_provider_id
                })),
                debug: {
                    payer_id,
                    date: requestDate,
                    dayOfWeek,
                    bookable_providers_found: bookableProviders.length,
                    regular_providers: regularProviders.length,
                    co_visit_providers: coVisitProviders.length,
                    base_availability_records: availability?.length || 0,
                    exceptions_found: exceptions?.length || 0,
                    filtered_availability_records: filteredAvailability.length,
                    slots_generated: allSlots.length,
                    final_slots: finalSlots.length
                },
                message: `Found ${finalSlots.length} available appointment slots from ${bookableProviders.length} bookable providers (${regularProviders.length} regular + ${coVisitProviders.length} co-visit)`
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

// Utility functions (same as original)
function generateTimeSlotsFromAvailability(
    availability: any, 
    date: string, 
    provider: any, 
    appointmentDuration: number
): AvailableSlot[] {
    const slots: AvailableSlot[] = []
    
    try {
        const startTime = availability.start_time
        const endTime = availability.end_time
        
        const [startHour, startMin] = startTime.split(':').map(Number)
        const [endHour, endMin] = endTime.split(':').map(Number)
        
        const baseDate = new Date(date)
        let currentTime = new Date(baseDate)
        currentTime.setHours(startHour, startMin, 0, 0)
        
        const endDateTime = new Date(baseDate)
        endDateTime.setHours(endHour, endMin, 0, 0)
        
        while (currentTime < endDateTime) {
            const slotEndTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
            
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
            
            currentTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
        }
        
    } catch (error) {
        console.error('❌ Error generating time slots:', error)
    }
    
    return slots
}

function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5)
}

async function filterConflictingAppointments(slots: AvailableSlot[], date: string): Promise<AvailableSlot[]> {
    console.log(`🔍 Checking for appointment conflicts on ${date}...`)
    
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
            const { data: provider, error } = await supabaseAdmin
                .from('providers')
                .select('intakeq_practitioner_id')
                .eq('id', providerId)
                .single()

            if (error || !provider?.intakeq_practitioner_id) {
                console.log(`⚠️ No IntakeQ practitioner ID for provider ${providerId}, skipping conflict check`)
                filteredSlots.push(...providerSlots)
                continue
            }

            const existingAppointments = await intakeQService.getAppointmentsForDate(
                provider.intakeq_practitioner_id, 
                date
            )

            console.log(`📅 Provider ${providerId} has ${existingAppointments.length} existing appointments`)

            const availableSlots = providerSlots.filter(slot => {
                const slotStartTime = new Date(`${slot.date}T${slot.time}:00`).getTime()
                
                const hasConflict = existingAppointments.some(appointment => {
                    const appointmentStart = new Date(appointment.StartDate)
                    const appointmentEnd = new Date(appointment.EndDate || (appointment.StartDate + 60 * 60 * 1000))
                    
                    const slotStart = new Date(slotStartTime)
                    const slotEnd = new Date(slotStartTime + 60 * 60 * 1000)
                    
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
            filteredSlots.push(...providerSlots)
        }
    }
    
    return filteredSlots
}
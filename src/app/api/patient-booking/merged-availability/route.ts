// INTAKE-ONLY VERSION: Resolves single Intake Telehealth service instance for payer upfront
// service_instance_id: Single serviceInstanceId resolved from payer, not per-slot
// New behavior: Returns one serviceInstanceId at response root, slots contain only time info
// Fixed: Eliminated per-provider service instance variation for Intake bookings
import { supabaseAdmin } from '@/lib/supabase'
import { intakeQService } from '@/lib/services/intakeQService'
import { ensureCacheExists } from '@/lib/services/availabilityCacheService'
import { resolveIntakeServiceInstance } from '@/lib/services/intakeResolver'
import { BookableProviderPayer } from '@/types/database'
import { NextRequest, NextResponse } from 'next/server'
import { featureFlags } from '@/lib/config/featureFlags'

// Simplified slot interface for Intake-only (no per-slot service instance)
interface IntakeSlot {
    date: string
    time: string
    providerId: string
    providerName: string
    provider: {
        id: string
        first_name: string
        last_name: string
        title: string
        role: string
    }
    // Co-visit support (if needed for Intake)
    isCoVisit?: boolean
    attendingProviderId?: string
    attendingName?: string
    supervisionLevel?: 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required'
}

// Legacy function removed - now using getPrimaryServiceInstance with gating

export async function POST(request: NextRequest) {
    try {
        // Safe JSON parsing - handle empty body, 204 responses, or HTML error pages
        let body: any = {}
        try {
            const text = await request.text()
            if (text && text.trim().length > 0) {
                body = JSON.parse(text)
            }
        } catch (parseError: any) {
            console.error('❌ Failed to parse request body:', parseError.message)
            return NextResponse.json({
                success: false,
                error: 'Invalid request body - expected JSON',
                details: parseError.message
            }, { status: 400 })
        }

        const { payer_id, date, startDate, endDate, provider_id } = body

        const requestDate = date || startDate
        const requestEndDate = endDate || date

        // Dev-only: allow bypassing conflict filter for debugging
        const { searchParams } = new URL(request.url)
        const debugBypassConflicts = process.env.NODE_ENV !== 'production' && searchParams.get('debug_bypass_conflicts') === '1'

        if (!payer_id) {
            return NextResponse.json(
                { error: 'payer_id is required', code: 'PAYER_REQUIRED', success: false },
                { status: 422 }
            )
        }

        if (!requestDate) {
            return NextResponse.json(
                { error: 'date is required', success: false },
                { status: 400 }
            )
        }

        // UUID validation for payer_id (except for cash payment)
        if (payer_id !== 'cash-payment') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(payer_id)) {
                console.log(`❌ Invalid payer_id format: ${payer_id}`)
                return NextResponse.json(
                    { error: `Invalid payer_id format: ${payer_id}`, code: 'INVALID_PAYER_ID', success: false },
                    { status: 422 }
                )
            }
        }

        console.log(`🔍 Getting Intake-only availability for payer ${payer_id} on ${requestDate}${provider_id ? ` (provider: ${provider_id})` : ''}`)

        // Step 1: Resolve single Intake Telehealth service instance for payer (single DB call)
        let serviceInstanceId: string
        let durationMinutes: number

        try {
            const intakeInstance = await resolveIntakeServiceInstance(payer_id)
            serviceInstanceId = intakeInstance.serviceInstanceId
            durationMinutes = intakeInstance.durationMinutes
            console.log(`✅ Resolved Intake service instance: ${serviceInstanceId} (${durationMinutes}min)`)
        } catch (error: any) {
            console.error('❌ Failed to resolve Intake service instance:', error)
            return NextResponse.json(
                {
                    error: error.message,
                    code: error.code || 'NO_INTAKE_INSTANCE_FOR_PAYER',
                    payerId: error.payerId || payer_id,
                    success: false,
                    debug: error.debug ?? undefined
                },
                { status: error.status || 422 }
            )
        }

        // Step 2: Auto-populate cache if needed
        console.log(`🔄 Ensuring cache exists for date range ${requestDate} to ${requestEndDate}...`)
        const cacheResult = await ensureCacheExists(requestDate, requestEndDate)
        if (!cacheResult.success) {
            console.error(`⚠️ Cache auto-population failed (non-fatal): ${cacheResult.error}`)
        } else if (cacheResult.recordsCreated > 0) {
            console.log(`✅ Auto-populated cache with ${cacheResult.recordsCreated} records`)
        } else {
            console.log(`✅ Cache already exists for requested date range`)
        }

        // Step 3: Get BOOKABLE providers (special handling for cash payment)
        let bookableProviders: any[] = []

        if (payer_id === 'cash-payment') {
            console.log('💵 Cash payment detected - fetching all providers accepting new patients')

            // For cash payment, get all providers that accept new patients
            const { data: cashProviders, error: cashError } = await supabaseAdmin
                .from('providers')
                .select('*')
                .eq('is_bookable', true)
                .eq('accepts_new_patients', true)

            if (cashError) {
                console.error('❌ Error fetching cash payment providers:', cashError)
                return NextResponse.json(
                    { error: 'Failed to fetch cash payment providers', details: cashError, success: false },
                    { status: 500 }
                )
            }

            // Transform to expected format for cash payment
            bookableProviders = cashProviders?.map(provider => ({
                provider_id: provider.id,
                payer_id: 'cash-payment',
                via: 'direct',
                attending_provider_id: null,
                supervision_level: null,
                requires_co_visit: false,
                effective: true,
                bookable_from_date: null,
                first_name: provider.first_name,
                last_name: provider.last_name,
                title: provider.title,
                role: provider.role,
                provider_type: provider.provider_type,
                is_active: provider.is_active,
                is_bookable: provider.is_bookable
            })) || []

            console.log(`💵 Found ${bookableProviders.length} providers for cash payment`)
        } else {
            // Use canonical view for insurance payers
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
            bookableProviders = bookableRelationships?.map(rel => ({
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
        }

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

        // Service instance lookups now handled by getPrimaryServiceInstance with gating

        // Separate providers that need co-visit from regular providers
        const coVisitProviders = bookableProviders.filter(bp => bp.requires_co_visit)
        const regularProviders = bookableProviders.filter(bp => !bp.requires_co_visit)
        
        console.log(`🔄 Provider breakdown: ${regularProviders.length} regular, ${coVisitProviders.length} co-visit required`)

        const targetDate = new Date(requestDate)
        const dayOfWeek = targetDate.getDay()
        console.log(`📅 Target date ${requestDate} is day of week ${dayOfWeek} (0=Sun, 1=Mon, etc.)`)

        // Step 2: Get base availability for ONLY these bookable providers
        // CRITICAL: Filter by bookable providers to exclude Doug Sirutis and other non-bookable providers
        // V2.0: Also filter by accepts_new_patients for intake flows when flag enabled
        let bookableQuery = supabaseAdmin
            .from('providers')
            .select('id')
            .eq('is_bookable', true)
            .not('intakeq_practitioner_id', 'is', null)

        // Apply new patient filter if feature flag enabled
        if (featureFlags.intakeHideNonIntakeProviders) {
            bookableQuery = bookableQuery.eq('accepts_new_patients', true)
            console.log('✅ V2.0: Filtering availability for accepts_new_patients=true (feature flag enabled)')
        }

        const { data: allProviders } = await bookableQuery

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

        // Step 5: Generate time slots using resolved Intake serviceInstanceId and durationMinutes
        const allSlots: IntakeSlot[] = []

        // Process all bookable providers using the single resolved Intake service instance
        for (const avail of filteredAvailability || []) {
            const provider = bookableProviders.find(bp => bp.provider_id === avail.provider_id)
            if (!provider) continue

            console.log(`⏰ Provider ${provider.first_name} ${provider.last_name}: ${avail.start_time} - ${avail.end_time}`)

            try {
                // Use the already-resolved Intake service instance and duration
                const slots = generateIntakeTimeSlotsFromAvailability(
                    avail,
                    requestDate,
                    {
                        id: provider.provider_id,
                        first_name: provider.first_name || '',
                        last_name: provider.last_name || '',
                        title: provider.title || 'MD',
                        role: provider.role || 'physician'
                    },
                    durationMinutes
                )

                allSlots.push(...slots)
                console.log(`✅ Generated ${slots.length} Intake slots for ${provider.first_name} ${provider.last_name} (${durationMinutes}min duration)`)

            } catch (error: any) {
                console.error(`❌ Error processing provider ${provider.first_name} ${provider.last_name}:`, error.message)
                // Continue with other providers on error
                continue
            }
        }

        allSlots.sort((a, b) => a.time.localeCompare(b.time))
        console.log(`✅ Generated ${allSlots.length} total time slots from bookable providers`)

        // DEV: Log serviceInstanceId presence for debugging
        if (process.env.NODE_ENV === 'development' && allSlots.length > 0) {
            const sampleSlot = allSlots[0]
            console.log('🔧 DEV: Sample slot with serviceInstanceId:', {
                time: sampleSlot.time,
                provider: sampleSlot.providerName,
                serviceInstanceId: sampleSlot.serviceInstanceId,
                hasServiceId: !!sampleSlot.serviceInstanceId
            })
        }

        // Step 6: Filter out appointment conflicts (both local and IntakeQ)
        let finalSlots = allSlots
        let conflictStats = { removedByLocal: 0, removedByPQ: 0, kept: allSlots.length }

        if (debugBypassConflicts) {
            console.log(`⚠️ DEBUG: Bypassing conflict filter (debug_bypass_conflicts=1)`)
            // Still compute stats but don't filter
            const { slots: filteredSlots, stats } = await filterIntakeConflictingAppointmentsWithStats(
                allSlots,
                requestDate,
                serviceInstanceId,
                durationMinutes
            )
            conflictStats = stats
        } else {
            const { slots: filteredSlots, stats } = await filterIntakeConflictingAppointmentsWithStats(
                allSlots,
                requestDate,
                serviceInstanceId,
                durationMinutes
            )
            finalSlots = filteredSlots
            conflictStats = stats
        }

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
                // Intake-only contract: single service instance resolved from payer
                serviceInstanceId,
                durationMinutes,
                totalSlots: finalSlots.length,
                slots: finalSlots, // Primary slots array
                availableSlots: finalSlots, // Compatibility alias
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
                    intake_only: true,
                    single_service_instance_resolved: true,
                    bookableProviderCount: bookableProviders.length,
                    cache: {
                        ensured: cacheResult.success,
                        strategy: cacheResult.recordsCreated > 0 ? 'auto-populated' : 'already-exists',
                        range: { start: requestDate, end: requestEndDate },
                        recordsCreated: cacheResult.recordsCreated
                    },
                    availabilityRecords: {
                        total: availability?.length || 0,
                        byProvider: (availability || []).reduce((acc, avail) => {
                            const pid = avail.provider_id
                            acc[pid] = (acc[pid] || 0) + 1
                            return acc
                        }, {} as Record<string, number>)
                    },
                    slotGen: {
                        generated: allSlots.length,
                        keptBeforeConflictFilter: allSlots.length
                    },
                    conflictFilter: {
                        removedByLocal: conflictStats.removedByLocal,
                        removedByPQ: conflictStats.removedByPQ,
                        kept: conflictStats.kept,
                        bypassed: debugBypassConflicts
                    },
                    tz: {
                        server: process.env.TZ ?? 'unset',
                        clinic: 'America/Denver'
                    },
                    resolved_duration_minutes: durationMinutes
                }
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

// Intake-only utility functions
function generateIntakeTimeSlotsFromAvailability(
    availability: any,
    date: string,
    provider: any,
    appointmentDuration: number
): IntakeSlot[] {
    const slots: IntakeSlot[] = []

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

        console.log(`🕒 Generating slots from ${formatTime(currentTime)} to ${formatTime(endDateTime)} with ${appointmentDuration}min duration`)

        while (currentTime < endDateTime) {
            const slotEndTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)

            if (slotEndTime <= endDateTime) {
                slots.push({
                    date: date,
                    time: formatTime(currentTime),
                    providerId: availability.provider_id,
                    providerName: `${provider.first_name} ${provider.last_name}`,
                    provider: {
                        id: provider.id,
                        first_name: provider.first_name,
                        last_name: provider.last_name,
                        title: provider.title || '',
                        role: provider.role || ''
                    }
                })
            } else {
                console.log(`⏰ Skipping partial slot ${formatTime(currentTime)}-${formatTime(slotEndTime)} (exceeds availability window)`)
            }

            currentTime = new Date(currentTime.getTime() + appointmentDuration * 60 * 1000)
        }

        console.log(`✅ Generated ${slots.length} slots for ${provider.first_name} ${provider.last_name}`)

    } catch (error) {
        console.error('❌ Error generating time slots:', error)
    }

    return slots
}

function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5)
}

// Intake-specific conflict checking for single service instance
async function filterIntakeConflictingAppointments(
    slots: IntakeSlot[],
    date: string,
    serviceInstanceId: string,
    durationMinutes: number
): Promise<IntakeSlot[]> {
    console.log(`🔍 Intake conflict filter for ${date}, sid=${serviceInstanceId}, duration=${durationMinutes}m`)

    const slotsByProvider = slots.reduce((acc, slot) => {
        const providerId = slot.providerId
        if (!acc[providerId]) {
            acc[providerId] = []
        }
        acc[providerId].push(slot)
        return acc
    }, {} as Record<string, IntakeSlot[]>)

    const filteredSlots: IntakeSlot[] = []

    for (const [providerId, providerSlots] of Object.entries(slotsByProvider)) {
        try {
            // Check local database conflicts for ALL appointments (any service type)
            // A provider can only be in one place at a time regardless of payer/service
            const { data: localConflicts, error: localError } = await supabaseAdmin
                .from('appointments')
                .select('start_time, end_time')
                .eq('provider_id', providerId)
                .eq('status', 'scheduled')
                .gte('start_time', `${date}T00:00:00Z`)
                .lt('start_time', `${date}T23:59:59Z`)

            if (localError) {
                console.error(`❌ Error checking local conflicts for provider ${providerId}:`, localError)
                // Continue with IntakeQ check
            }

            const localConflictTimes = localConflicts?.map(appt => ({
                start: new Date(appt.start_time),
                end: new Date(appt.end_time)
            })) || []

            console.log(`📅 Provider ${providerId} has ${localConflictTimes.length} local scheduled appointments`)

            // Check IntakeQ conflicts
            const { data: provider, error } = await supabaseAdmin
                .from('providers')
                .select('intakeq_practitioner_id')
                .eq('id', providerId)
                .single()

            let intakeqConflictTimes: Array<{start: Date, end: Date}> = []
            if (!error && provider?.intakeq_practitioner_id) {
                try {
                    const existingAppointments = await intakeQService.getAppointmentsForDate(
                        provider.intakeq_practitioner_id,
                        date
                    )

                    intakeqConflictTimes = existingAppointments.map(appointment => ({
                        start: new Date(appointment.StartDate),
                        end: new Date(appointment.EndDate || (appointment.StartDate + durationMinutes * 60 * 1000))
                    }))

                    console.log(`📅 Provider ${providerId} has ${intakeqConflictTimes.length} IntakeQ appointments`)
                } catch (intakeqError: any) {
                    console.warn(`⚠️ Failed to check IntakeQ conflicts for provider ${providerId}:`, intakeqError.message)
                }
            } else {
                console.log(`⚠️ No IntakeQ practitioner ID for provider ${providerId}, skipping IntakeQ conflict check`)
            }

            // Filter slots against all conflicts (using resolved Intake duration)
            const availableSlots = providerSlots.filter(slot => {
                const slotStart = new Date(`${slot.date}T${slot.time}:00`)
                const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)

                // Check local conflicts
                const hasLocalConflict = localConflictTimes.some(conflict =>
                    slotStart < conflict.end && slotEnd > conflict.start
                )

                // Check IntakeQ conflicts
                const hasIntakeqConflict = intakeqConflictTimes.some(conflict =>
                    slotStart < conflict.end && slotEnd > conflict.start
                )

                if (hasLocalConflict) {
                    console.log(`⚠️ Slot ${slot.time} conflicts with local appointment, removing`)
                }
                if (hasIntakeqConflict) {
                    console.log(`⚠️ Slot ${slot.time} conflicts with IntakeQ appointment, removing`)
                }

                return !hasLocalConflict && !hasIntakeqConflict
            })

            filteredSlots.push(...availableSlots)
            console.log(`✅ Provider ${providerId}: ${availableSlots.length}/${providerSlots.length} slots available after conflict check`)

        } catch (error: any) {
            console.error(`❌ Error checking conflicts for provider ${providerId}:`, error.message)
            // In case of error, include slots but log the issue
            filteredSlots.push(...providerSlots)
        }
    }

    return filteredSlots
}

// Enhanced version with stats tracking
async function filterIntakeConflictingAppointmentsWithStats(
    slots: IntakeSlot[],
    date: string,
    serviceInstanceId: string,
    durationMinutes: number
): Promise<{ slots: IntakeSlot[], stats: { removedByLocal: number, removedByPQ: number, kept: number } }> {
    console.log(`🔍 Intake conflict filter (with stats) for ${date}, sid=${serviceInstanceId}, duration=${durationMinutes}m`)

    const slotsByProvider = slots.reduce((acc, slot) => {
        const providerId = slot.providerId
        if (!acc[providerId]) {
            acc[providerId] = []
        }
        acc[providerId].push(slot)
        return acc
    }, {} as Record<string, IntakeSlot[]>)

    const providerIds = Object.keys(slotsByProvider)
    console.log(`⚡ Parallel conflict check for ${providerIds.length} providers`)

    // OPTIMIZATION: Batch all database queries in parallel
    const [localConflictsResult, providersResult] = await Promise.all([
        // Single query for ALL providers' local conflicts
        supabaseAdmin
            .from('appointments')
            .select('provider_id, start_time, end_time')
            .in('provider_id', providerIds)
            .eq('status', 'scheduled')
            .gte('start_time', `${date}T00:00:00Z`)
            .lt('start_time', `${date}T23:59:59Z`),

        // Single query for ALL providers' IntakeQ IDs
        supabaseAdmin
            .from('providers')
            .select('id, intakeq_practitioner_id')
            .in('id', providerIds)
    ])

    if (localConflictsResult.error) {
        console.error(`❌ Error checking local conflicts:`, localConflictsResult.error)
    }

    if (providersResult.error) {
        console.error(`❌ Error fetching provider IntakeQ IDs:`, providersResult.error)
    }

    // Group local conflicts by provider
    const localConflictsByProvider = (localConflictsResult.data || []).reduce((acc, appt) => {
        if (!acc[appt.provider_id]) {
            acc[appt.provider_id] = []
        }
        acc[appt.provider_id].push({
            start: new Date(appt.start_time),
            end: new Date(appt.end_time)
        })
        return acc
    }, {} as Record<string, Array<{start: Date, end: Date}>>)

    // OPTIMIZATION: Parallelize all IntakeQ API calls
    const intakeqConflictsPromises = (providersResult.data || []).map(async (provider) => {
        if (!provider.intakeq_practitioner_id) {
            return { providerId: provider.id, conflicts: [] }
        }

        try {
            const existingAppointments = await intakeQService.getAppointmentsForDate(
                provider.intakeq_practitioner_id,
                date
            )

            const conflicts = existingAppointments.map(appointment => ({
                start: new Date(appointment.StartDate),
                end: new Date(appointment.EndDate || (appointment.StartDate + durationMinutes * 60 * 1000))
            }))

            return { providerId: provider.id, conflicts }
        } catch (error: any) {
            console.warn(`⚠️ Failed to check IntakeQ conflicts for provider ${provider.id}:`, error.message)
            return { providerId: provider.id, conflicts: [] }
        }
    })

    const intakeqConflictsResults = await Promise.all(intakeqConflictsPromises)
    const intakeqConflictsByProvider = intakeqConflictsResults.reduce((acc, result) => {
        acc[result.providerId] = result.conflicts
        return acc
    }, {} as Record<string, Array<{start: Date, end: Date}>>)

    console.log(`✅ Loaded conflicts for ${providerIds.length} providers in parallel`)

    // Filter slots using pre-loaded conflict data
    const filteredSlots: IntakeSlot[] = []
    let removedByLocal = 0
    let removedByPQ = 0

    for (const [providerId, providerSlots] of Object.entries(slotsByProvider)) {
        const localConflictTimes = localConflictsByProvider[providerId] || []
        const intakeqConflictTimes = intakeqConflictsByProvider[providerId] || []

        const availableSlots = providerSlots.filter(slot => {
            const slotStart = new Date(`${slot.date}T${slot.time}:00`)
            const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)

            const hasLocalConflict = localConflictTimes.some(conflict =>
                slotStart < conflict.end && slotEnd > conflict.start
            )

            const hasIntakeqConflict = intakeqConflictTimes.some(conflict =>
                slotStart < conflict.end && slotEnd > conflict.start
            )

            if (hasLocalConflict) {
                removedByLocal++
            }
            if (hasIntakeqConflict) {
                removedByPQ++
            }

            return !hasLocalConflict && !hasIntakeqConflict
        })

        filteredSlots.push(...availableSlots)
    }

    return {
        slots: filteredSlots,
        stats: {
            removedByLocal,
            removedByPQ,
            kept: filteredSlots.length
        }
    }
}
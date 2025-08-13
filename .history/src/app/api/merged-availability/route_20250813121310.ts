// src/app/api/merged-availability/route.ts
import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface TimeSlot {
    id: string
    provider_id: string
    start_time: string
    end_time: string
    is_available: boolean
    appointment_type: string
    service_instance_id: string
    provider_name?: string | null
}

type Source = 'cache' | 'recurring'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { payer_id, date } = body

        if (!payer_id || !date) {
            return NextResponse.json(
                { success: false, error: 'payer_id and date are required' },
                { status: 400 }
            )
        }

        // STEP 1: which providers accept this payer (active network & active provider)
        const { data: networks, error: networksError } = await supabase
            .from('provider_payer_networks')
            .select(`
        provider_id,
        providers!inner(
          id,
          first_name,
          last_name,
          is_active
        )
      `)
            .eq('payer_id', payer_id)
            .eq('status', 'active')
            .eq('providers.is_active', true)

        if (networksError) {
            console.error('❌ Error fetching provider networks:', networksError)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider networks' },
                { status: 500 }
            )
        }

        const acceptingProviders = (networks ?? []).map(n => n.provider_id)
        if (acceptingProviders.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    availableSlots: [],
                    providersCount: 0,
                    availabilityRecords: 0,
                    date,
                    dayOfWeek: new Date(date).getDay(),
                    message: 'No providers currently accept this insurance',
                    source: 'recurring' as Source
                }
            })
        }

        // STEP 2: compute the day window [local date 00:00, +1 day)
        const targetDate = new Date(date)
        const dayOfWeek = targetDate.getDay()
        const dayStart = new Date(targetDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

        const withinDay = (iso?: string) => {
            if (!iso) return false
            const d = new Date(iso).getTime()
            return d >= dayStart.getTime() && d < dayEnd.getTime()
        }

        // ---------- CACHE FIRST ----------
        // provider_availability_cache.available_slots: JSONB array of slot objects
        // Accept common shapes:
        //   { start_time, end_time?, duration_minutes?, service_instance_id?, provider_name? }
        const { data: cacheRows, error: cacheErr } = await supabase
            .from('provider_availability_cache')
            .select('provider_id, available_slots')
            .in('provider_id', acceptingProviders)

        let source: Source = 'recurring'
        if (cacheErr) {
            console.error('❌ availability_cache fetch error:', cacheErr)
        }

        let timeSlots: TimeSlot[] = []
        if (Array.isArray(cacheRows) && cacheRows.length) {
            for (const row of cacheRows) {
                const pid = (row as any).provider_id as string
                const slots = (row as any).available_slots as Array<any> | null
                if (!Array.isArray(slots)) continue
                for (const s of slots) {
                    const iso = s?.start_time as string | undefined
                    if (!withinDay(iso)) continue
                    const duration = Number(s?.duration_minutes ?? 60)
                    const startMs = new Date(iso!).getTime()
                    const endIso = (s?.end_time as string | undefined) ?? new Date(startMs + duration * 60000).toISOString()
                    timeSlots.push({
                        id: `${pid}-${iso}`,
                        provider_id: pid,
                        start_time: iso!,
                        end_time: endIso,
                        is_available: true,
                        appointment_type: 'telehealth', // default; refine if you store type per slot
                        service_instance_id: String(s?.service_instance_id ?? 'default-service'),
                        provider_name: (s?.provider_name ?? null)
                    })
                }
            }
            if (timeSlots.length > 0) {
                source = 'cache'
            }
        }

        // ---------- FALLBACK TO RECURRING RULES ----------
        if (timeSlots.length === 0) {
            const { data: availability, error: availabilityError } = await supabase
                .from('provider_availability')
                .select('*')
                .in('provider_id', acceptingProviders)
                .eq('day_of_week', dayOfWeek)
                .eq('is_recurring', true)

            if (availabilityError) {
                console.error('❌ Error fetching availability:', availabilityError)
                return NextResponse.json(
                    { success: false, error: 'Failed to fetch availability' },
                    { status: 500 }
                )
            }

            const slotDurationMinutes = 60 // your original behavior
            for (const avail of availability ?? []) {
                try {
                    const startTime = (avail as any).start_time as string // "HH:MM:SS"
                    const endTime = (avail as any).end_time as string     // "HH:MM:SS"
                    const [sh, sm] = startTime.split(':').map(Number)
                    const [eh, em] = endTime.split(':').map(Number)

                    const start = new Date(targetDate)
                    start.setHours(sh, sm, 0, 0)
                    const end = new Date(targetDate)
                    end.setHours(eh, em, 0, 0)

                    for (let cur = new Date(start); cur < end; cur = new Date(cur.getTime() + slotDurationMinutes * 60000)) {
                        const next = new Date(cur.getTime() + slotDurationMinutes * 60000)
                        if (next > end) break

                        timeSlots.push({
                            id: `${(avail as any).provider_id}-${cur.toISOString()}`,
                            provider_id: (avail as any).provider_id,
                            start_time: cur.toISOString(),
                            end_time: next.toISOString(),
                            is_available: true,
                            appointment_type: 'telehealth',
                            service_instance_id: String((avail as any).service_instance_id ?? 'default-service')
                        })
                    }
                } catch (e) {
                    console.error('❌ Error generating slots for availability:', (avail as any).id, e)
                }
            }
            source = 'recurring'
        }

        // Sort chronologically
        timeSlots.sort((a, b) => a.start_time.localeCompare(b.start_time))

        return NextResponse.json({
            success: true,
            data: {
                availableSlots: timeSlots,
                providersCount: acceptingProviders.length,
                availabilityRecords: source === 'cache' ? (cacheRows?.length ?? 0) : timeSlots.length,
                date,
                dayOfWeek,
                source
            }
        })
    } catch (error) {
        console.error('💥 Error in merged availability API:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}

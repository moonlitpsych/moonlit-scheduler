// src/lib/availability.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

type ISODate = string

export type TimeSlot = {
    provider_id: string
    service_instance_id: string
    start_time: ISODate // ISO string
    duration_minutes: number
}

export async function getCachedSlotsForProviders(
    providerIds: string[],
    rangeStartISO: ISODate,
    rangeEndISO: ISODate
): Promise<TimeSlot[]> {
    if (!providerIds.length) return []

    // Provider availability cache rows commonly look like:
    // { provider_id, date, available_slots (jsonb array of {start_time, duration_minutes, service_instance_id}) }
    const { data, error } = await supabase
        .from('provider_availability_cache')
        .select('provider_id, available_slots')
        .in('provider_id', providerIds)

    if (error) {
        console.error('availability_cache fetch error:', error)
        return []
    }

    const inRange = (iso: string) => iso >= rangeStartISO && iso < rangeEndISO

    const slots: TimeSlot[] = []
    for (const row of data ?? []) {
        const arr = (row as any).available_slots as Array<any> | null
        if (!Array.isArray(arr)) continue
        for (const s of arr) {
            if (!s?.start_time) continue
            if (!inRange(s.start_time)) continue
            slots.push({
                provider_id: (row as any).provider_id as string,
                service_instance_id: s.service_instance_id ?? null,
                start_time: s.start_time,
                duration_minutes: s.duration_minutes ?? 60
            })
        }
    }
    return slots
}

/**
 * Fallback to recurring rules table (simple MVP: join provider_availability by weekday & window).
 * You can refine this later, but this keeps parity with current logic.
 */
export async function getRecurringSlotsForProviders(
    providerIds: string[],
    rangeStartISO: ISODate,
    rangeEndISO: ISODate
): Promise<TimeSlot[]> {
    if (!providerIds.length) return []

    // Expecting table `provider_availability` with columns like:
    // provider_id, weekday (0-6), start_time (HH:MM), end_time (HH:MM), service_instance_id, slot_minutes
    const { data, error } = await supabase
        .from('provider_availability')
        .select('provider_id, weekday, start_time, end_time, service_instance_id, slot_minutes')
        .in('provider_id', providerIds)

    if (error || !data) {
        if (error) console.error('provider_availability fetch error:', error)
        return []
    }

    const start = new Date(rangeStartISO)
    const end = new Date(rangeEndISO)
    const millisPerDay = 24 * 60 * 60 * 1000

    const toIso = (d: Date) => d.toISOString()
    const slots: TimeSlot[] = []

    for (let t = start.getTime(); t < end.getTime(); t += millisPerDay) {
        const day = new Date(t)
        const weekday = day.getUTCDay() // 0-6

        for (const row of data) {
            if ((row as any).weekday !== weekday) continue
            const slotMinutes = (row as any).slot_minutes ?? 60

            // Build time window on this date using UTC
            const [sh, sm] = String((row as any).start_time || '09:00').split(':').map(Number)
            const [eh, em] = String((row as any).end_time || '17:00').split(':').map(Number)

            const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), sh, sm))
            const dayEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), eh, em))

            // iterate in slotMinutes
            for (let cur = dayStart.getTime(); cur + slotMinutes * 60000 <= dayEnd.getTime(); cur += slotMinutes * 60000) {
                const iso = new Date(cur).toISOString()
                // guard range
                if (iso < rangeStartISO || iso >= rangeEndISO) continue
                slots.push({
                    provider_id: (row as any).provider_id as string,
                    service_instance_id: (row as any).service_instance_id ?? null,
                    start_time: iso,
                    duration_minutes: slotMinutes
                })
            }
        }
    }
    return slots
}

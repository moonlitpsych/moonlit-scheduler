// src/app/api/patient-booking/merged-availability/route.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type ISODate = string

type SlotOut = {
    provider_id: string
    service_instance_id: string | null
    start_time: ISODate            // ISO string (new, preferred)
    duration_minutes: number
    // Back-compat fields so older UI keeps working:
    date: string                   // YYYY-MM-DD
    start_time_hm: string          // HH:MM
    provider_name?: string | null  // optional if you have it handy
}

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

function toDateHM(iso: string) {
    const d = new Date(iso)
    // format as YYYY-MM-DD and HH:MM (local time)
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hh = d.getHours()
    const mm = d.getMinutes()
    return {
        date: `${y}-${m}-${day}`,
        hm: `${pad(hh)}:${pad(mm)}`
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const {
            payer_id,
            range_start,
            range_end,
            language,         // optional filter
            provider_ids,     // optional explicit list from client
        } = body ?? {}

        if (!payer_id || !range_start || !range_end) {
            return NextResponse.json(
                { success: false, error: 'payer_id, range_start, and range_end are required' },
                { status: 400 }
            )
        }

        // 1) Which providers are eligible for this payer?
        let eligibleProviderIds: string[] = Array.isArray(provider_ids) ? provider_ids : []

        if (!eligibleProviderIds.length) {
            // base filter from provider_payer_networks
            const { data: networkRows, error: netErr } = await supabase
                .from('provider_payer_networks')
                .select('provider_id')
                .eq('payer_id', payer_id)

            if (netErr) {
                console.error('provider_payer_networks error', netErr)
                return NextResponse.json({ success: false, error: 'provider filter failed' }, { status: 500 })
            }

            eligibleProviderIds = [...new Set((networkRows ?? []).map(r => (r as any).provider_id as string))]

            // Optional: narrow by provider attributes (e.g., accepts_new_patients, telehealth_enabled, language)
            if (eligibleProviderIds.length) {
                const { data: providers, error: provErr } = await supabase
                    .from('providers')
                    .select('id, accepts_new_patients, telehealth_enabled, languages_spoken, display_name')
                    .in('id', eligibleProviderIds)

                if (provErr) {
                    console.error('providers filter error', provErr)
                } else {
                    const lang = typeof language === 'string' ? language.toLowerCase() : null
                    eligibleProviderIds = (providers ?? [])
                        .filter(p => (p as any).accepts_new_patients !== false)
                        .filter(p => (p as any).telehealth_enabled !== false)
                        .filter(p => {
                            if (!lang) return true
                            const langs = ((p as any).languages_spoken ?? []) as string[]
                            return langs.map(s => s.toLowerCase()).includes(lang)
                        })
                        .map(p => (p as any).id as string)
                }
            }
        }

        if (!eligibleProviderIds.length) {
            return NextResponse.json({ success: true, slots: [] })
        }

        // 2) Try cache first (provider_availability_cache.available_slots JSONB)
        // We don’t always have dates split by range in the cache, so we’ll filter client-side by time range.
        const { data: cacheRows, error: cacheErr } = await supabase
            .from('provider_availability_cache')
            .select('provider_id, available_slots')
            .in('provider_id', eligibleProviderIds)

        if (cacheErr) {
            console.error('availability_cache fetch error:', cacheErr)
        }

        const inRange = (iso?: string) => {
            if (!iso) return false
            return iso >= range_start && iso < range_end
        }

        let slots: SlotOut[] = []
        if (Array.isArray(cacheRows) && cacheRows.length) {
            for (const row of cacheRows) {
                const pid = (row as any).provider_id as string
                const arr = (row as any).available_slots as Array<any> | null
                if (!Array.isArray(arr)) continue
                for (const s of arr) {
                    const iso = s?.start_time as string | undefined
                    if (!inRange(iso)) continue
                    const { date, hm } = toDateHM(iso!)
                    slots.push({
                        provider_id: pid,
                        service_instance_id: s?.service_instance_id ?? null,
                        start_time: iso!,
                        duration_minutes: s?.duration_minutes ?? 60,
                        date,
                        start_time_hm: hm,
                        provider_name: s?.provider_name ?? null,
                    })
                }
            }
        }

        // 3) If no cache slots, fall back to recurring rules (provider_availability)
        if (!slots.length) {
            const { data: availRows, error: availErr } = await supabase
                .from('provider_availability')
                .select('provider_id, weekday, start_time, end_time, service_instance_id, slot_minutes')
                .in('provider_id', eligibleProviderIds)

            if (availErr) {
                console.error('provider_availability fetch error:', availErr)
                return NextResponse.json({ success: false, error: 'availability fetch failed' }, { status: 500 })
            }

            // generate slots for each day in [range_start, range_end)
            const start = new Date(range_start)
            const end = new Date(range_end)
            const oneDay = 24 * 60 * 60 * 1000
            const pad = (n: number) => String(n).padStart(2, '0')

            for (let t = start.getTime(); t < end.getTime(); t += oneDay) {
                const day = new Date(t)
                const weekday = day.getUTCDay() // 0-6

                for (const r of availRows ?? []) {
                    if ((r as any).weekday !== weekday) continue
                    const slotMinutes = (r as any).slot_minutes ?? 60
                    const [sh, sm] = String((r as any).start_time || '09:00').split(':').map(Number)
                    const [eh, em] = String((r as any).end_time || '17:00').split(':').map(Number)

                    const windowStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), sh, sm))
                    const windowEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), eh, em))

                    for (let cur = windowStart.getTime(); cur + slotMinutes * 60000 <= windowEnd.getTime(); cur += slotMinutes * 60000) {
                        const iso = new Date(cur).toISOString()
                        if (iso < range_start || iso >= range_end) continue

                        const local = new Date(iso)
                        const y = local.getFullYear()
                        const m = pad(local.getMonth() + 1)
                        const d = pad(local.getDate())
                        const hh = pad(local.getHours())
                        const mm = pad(local.getMinutes())

                        slots.push({
                            provider_id: (r as any).provider_id as string,
                            service_instance_id: (r as any).service_instance_id ?? null,
                            start_time: iso,
                            duration_minutes: slotMinutes,
                            date: `${y}-${m}-${d}`,
                            start_time_hm: `${hh}:${mm}`,
                            provider_name: null
                        })
                    }
                }
            }
        }

        // 4) Sort chronologically
        slots.sort((a, b) => a.start_time.localeCompare(b.start_time))

        return NextResponse.json({ success: true, slots })
    } catch (err: any) {
        console.error('merged-availability error', err)
        return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 })
    }
}

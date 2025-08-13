// src/app/api/merged-availability/route.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase client:
 * - Uses service role if present (server-side, bypasses RLS for inserts/joins as needed)
 * - Falls back to anon for local/dev if service key isn't set
 */
const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

type CachedSlot = {
    start_time: string // ISO
    end_time: string   // ISO
    service_instance_id?: string
}

type TimeSlot = {
    id: string
    provider_id: string
    start_time: string // ISO
    end_time: string   // ISO
    is_available: boolean
    appointment_type: 'telehealth' | 'in_person'
    service_instance_id: string | null
    provider_name?: string | null
    duration_minutes?: number
}

function isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function generateSlotsFromRecurring(avail: any, isoDate: string, slotMinutes = 60): TimeSlot[] {
    const slots: TimeSlot[] = []
    try {
        const [sh, sm] = String(avail.start_time).split(':').map(Number) // "09:00:00"
        const [eh, em] = String(avail.end_time).split(':').map(Number)
        const base = new Date(isoDate)
        const start = new Date(base); start.setHours(sh, sm || 0, 0, 0)
        const end = new Date(base); end.setHours(eh, em || 0, 0, 0)

        let cur = start
        while (cur < end) {
            const stop = new Date(cur.getTime() + slotMinutes * 60 * 1000)
            if (stop <= end) {
                slots.push({
                    id: `${avail.provider_id}-${cur.toISOString()}`,
                    provider_id: avail.provider_id,
                    start_time: cur.toISOString(),
                    end_time: stop.toISOString(),
                    is_available: true,
                    appointment_type: 'telehealth',
                    service_instance_id: null,
                    duration_minutes: slotMinutes,
                })
            }
            cur = new Date(cur.getTime() + slotMinutes * 60 * 1000)
        }
    } catch (e) {
        console.error('❌ Error generating recurring slots:', e)
    }
    return slots
}

export async function POST(req: NextRequest) {
    try {
        const { payer_id, date, duration_minutes = 60 } = await req.json()

        if (!payer_id || !date) {
            return NextResponse.json(
                { success: false, error: 'payer_id and date are required' },
                { status: 400 }
            )
        }

        // Resolve payer UUID (allow either UUID or a name/code like "ut_medicaid")
        let payerUuid = String(payer_id)
        if (!isUuid(payerUuid)) {
            // Try exact match on payers.name first, then ilike fallback.
            const exact = await supabase
                .from('payers')
                .select('id,name')
                .eq('name', payerUuid)
                .maybeSingle()

            if (exact.data?.id) {
                payerUuid = exact.data.id as string
            } else {
                const fuzzy = await supabase
                    .from('payers')
                    .select('id,name')
                    .ilike('name', `%${payerUuid}%`)
                    .limit(1)
                    .maybeSingle()

                if (fuzzy.data?.id) {
                    payerUuid = fuzzy.data.id as string
                } else {
                    return NextResponse.json(
                        { success: false, error: `Could not resolve payer_id "${payer_id}" to a UUID in payers.name` },
                        { status: 400 }
                    )
                }
            }
        }

        // 1) Providers who accept this payer (active)
        const networks = await supabase
            .from('provider_payer_networks')
            .select(`
        provider_id,
        status,
        providers!inner (
          id,
          first_name,
          last_name,
          is_active
        )
      `)
            .eq('payer_id', payerUuid)
            .eq('status', 'active')
            .eq('providers.is_active', true)

        if (networks.error) {
            console.error('❌ Error fetching provider networks:', networks.error)
            return NextResponse.json(
                { success: false, error: 'Failed to fetch provider networks' },
                { status: 500 }
            )
        }

        const providerIds = (networks.data || []).map(n => n.provider_id)
        const providerNameById = Object.fromEntries(
            (networks.data || []).map(n => [
                n.provider_id,
                `${(n as any).providers?.first_name ?? ''} ${(n as any).providers?.last_name ?? ''}`.trim() || null
            ])
        )

        if (providerIds.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    availableSlots: [],
                    providersCount: 0,
                    message: 'No providers currently accept this insurance'
                }
            })
        }

        // 2) Cache-first availability for the specific date
        const cache = await supabase
            .from('provider_availability_cache')
            .select('provider_id, date, available_slots')
            .in('provider_id', providerIds)
            .eq('date', date)

        const cachedSlots: TimeSlot[] = []
        const providersWithCache = new Set<string>()

        if (!cache.error && cache.data?.length) {
            for (const row of cache.data) {
                providersWithCache.add(String(row.provider_id))
                const slots: CachedSlot[] = Array.isArray(row.available_slots) ? row.available_slots : []
                for (const s of slots) {
                    cachedSlots.push({
                        id: `${row.provider_id}-${s.start_time}`,
                        provider_id: String(row.provider_id),
                        start_time: s.start_time,
                        end_time: s.end_time,
                        is_available: true,
                        appointment_type: 'telehealth',
                        service_instance_id: s.service_instance_id ?? null,
                        provider_name: providerNameById[String(row.provider_id)] ?? null,
                        duration_minutes: duration_minutes
                    })
                }
            }
        }

        // 3) Fallback to recurring rules for providers lacking cache
        const missing = providerIds.filter(id => !providersWithCache.has(String(id)))
        let fallbackSlots: TimeSlot[] = []
        if (missing.length > 0) {
            const d = new Date(date)
            const dayOfWeek = d.getDay() // 0=Sun

            const recurring = await supabase
                .from('provider_availability')
                .select('*')
                .in('provider_id', missing)
                .eq('day_of_week', dayOfWeek)
                .eq('is_recurring', true)

            if (recurring.error) {
                console.error('❌ Error fetching recurring availability:', recurring.error)
                return NextResponse.json(
                    { success: false, error: 'Failed to fetch availability' },
                    { status: 500 }
                )
            }

            for (const a of recurring.data || []) {
                const slots = generateSlotsFromRecurring(a, date, duration_minutes)
                for (const s of slots) {
                    s.provider_name = providerNameById[String(a.provider_id)] ?? null
                }
                fallbackSlots.push(...slots)
            }
        }

        // 4) Merge + sort by start time
        const all = [...cachedSlots, ...fallbackSlots].sort(
            (a, b) => +new Date(a.start_time) - +new Date(b.start_time)
        )

        return NextResponse.json({
            success: true,
            data: {
                date,
                providersCount: providerIds.length,
                cacheUsedForProviders: providersWithCache.size,
                availableSlots: all
            }
        })
    } catch (err: any) {
        console.error('💥 merged-availability exception:', err)
        return NextResponse.json(
            { success: false, error: err?.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

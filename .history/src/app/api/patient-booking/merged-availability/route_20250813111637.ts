import { getCachedSlotsForProviders, getRecurringSlotsForProviders } from '@/lib/availability'
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!.trim()
)

export async function POST(req: NextRequest) {
    try {
        const { payer_id, range_start, range_end, language, provider_ids } = await req.json()

        if (!payer_id || !range_start || !range_end) {
            return NextResponse.json({ success: false, error: 'payer_id, range_start, and range_end are required' }, { status: 400 })
        }

        // 1) Determine eligible providers for this payer (respecting requires_attending etc. if you already do)
        // If you passed provider_ids explicitly from the client, prefer that, else compute.
        let eligibleProviderIds: string[] = Array.isArray(provider_ids) ? provider_ids : []

        if (!eligibleProviderIds.length) {
            // Example: find providers who have a relationship for this payer & accept new patients & (optional language)
            let q = supabase
                .from('provider_payer_networks')
                .select('provider_id')
                .eq('payer_id', payer_id)

            // If you have a providers table filter, join via a second query for language and accepts_new_patients
            const { data: networkRows, error: netErr } = await q
            if (netErr) {
                console.error('provider_payer_networks error', netErr)
                return NextResponse.json({ success: false, error: 'provider filter failed' }, { status: 500 })
            }
            eligibleProviderIds = [...new Set((networkRows ?? []).map(r => (r as any).provider_id))]

            // Optional: narrow by language
            if (language) {
                const { data: providers, error: provErr } = await supabase
                    .from('providers')
                    .select('id, languages_spoken, accepts_new_patients, telehealth_enabled')
                    .in('id', eligibleProviderIds)

                if (provErr) {
                    console.error('providers filter error', provErr)
                } else {
                    eligibleProviderIds = (providers ?? [])
                        .filter(p => (p as any).accepts_new_patients !== false)
                        .filter(p => {
                            if (!language) return true
                            const langs = ((p as any).languages_spoken ?? []) as string[]
                            return langs.map(s => s.toLowerCase()).includes(String(language).toLowerCase())
                        })
                        .map(p => (p as any).id as string)
                }
            }
        }

        if (!eligibleProviderIds.length) {
            return NextResponse.json({ success: true, slots: [] })
        }

        // 2) Try cache first
        const cacheSlots = await getCachedSlotsForProviders(eligibleProviderIds, range_start, range_end)

        // 3) If no cache (or cache partially empty), supplement with recurring rules
        let finalSlots = cacheSlots
        if (!cacheSlots.length) {
            const recurring = await getRecurringSlotsForProviders(eligibleProviderIds, range_start, range_end)
            finalSlots = recurring
        }

        // 4) Sort chronologically
        finalSlots.sort((a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0))

        return NextResponse.json({ success: true, slots: finalSlots })
    } catch (err: any) {
        console.error('merged-availability error', err)
        return NextResponse.json({ success: false, error: err?.message || 'Unknown error' }, { status: 500 })
    }
}

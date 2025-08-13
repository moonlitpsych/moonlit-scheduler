'use client'

import { useEffect, useMemo, useState } from 'react'

// Shape returned by /api/merged-availability (your current version)
type Slot = {
    id: string
    provider_id: string
    start_time: string
    end_time: string
    is_available: boolean
    appointment_type: string
    service_instance_id: string | null
    provider_name?: string | null
    duration_minutes?: number
}

type ApiData = {
    date: string
    providersCount: number
    cacheUsedForProviders?: number
    availableSlots: Slot[]
    // older versions might include: source?: 'cache' | 'recurring'
}

type ApiResp =
    | { success: true; data: ApiData }
    | { success: false; error: string }

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function formatDT(iso: string) {
    return new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MiniCalendarPage() {
    // Defaults so the page "just works"
    const [payerId, setPayerId] = useState('a01d69d6-ae70-4917-afef-49b5ef7e5220') // Utah Medicaid FFS
    const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<ApiData | null>(null)

    // Initialize from query params if present
    useEffect(() => {
        const url = new URL(window.location.href)
        const qpPayer = url.searchParams.get('payer_id')
        const qpDate = url.searchParams.get('date')
        if (qpPayer) setPayerId(qpPayer)
        if (qpDate) setDate(qpDate)
    }, [])

    // Keep the URL in sync (so you can share links)
    useEffect(() => {
        const url = new URL(window.location.href)
        url.searchParams.set('payer_id', payerId)
        url.searchParams.set('date', date)
        window.history.replaceState({}, '', url.toString())
    }, [payerId, date])

    // Fetch slots whenever inputs change
    useEffect(() => {
        let gone = false
        const run = async () => {
            setLoading(true)
            setError(null)
            setData(null)
            try {
                const r = await fetch('/api/merged-availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payer_id: payerId, date }),
                })
                const j: ApiResp = await r.json()
                if (gone) return
                if (!j.success) {
                    setError(j.error || 'Request failed')
                } else {
                    setData(j.data)
                }
            } catch (e: any) {
                if (!gone) setError(e?.message || 'Network error')
            } finally {
                if (!gone) setLoading(false)
            }
        }
        run()
        return () => {
            gone = true
        }
    }, [payerId, date])

    // Group by hour for a compact view
    const grouped = useMemo(() => {
        const slots = data?.availableSlots ?? []
        const map = new Map<string, Slot[]>()
        for (const s of slots) {
            const hourKey = new Date(s.start_time).toISOString().slice(0, 13) // YYYY-MM-DDTHH
            if (!map.has(hourKey)) map.set(hourKey, [])
            map.get(hourKey)!.push(s)
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    }, [data])

    // Determine source badge (works even if API doesn't return `source`)
    const source: 'cache' | 'recurring' | null = useMemo(() => {
        if (!data) return null
        if (typeof data.cacheUsedForProviders === 'number') {
            return data.cacheUsedForProviders > 0 ? 'cache' : 'recurring'
        }
        // fallback if older API had data.source
        // @ts-ignore
        if (data?.source === 'cache' || data?.source === 'recurring') return data.source
        return null
    }, [data])

    // Helpers for date nav
    const moveDay = (delta: number) => {
        const d = new Date(date + 'T00:00:00')
        d.setDate(d.getDate() + delta)
        setDate(d.toISOString().slice(0, 10))
    }
    const today = () => setDate(new Date().toISOString().slice(0, 10))

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl p-6 space-y-4">
                <h1 className="text-2xl font-semibold">Mini Calendar (Test)</h1>
                <p className="text-sm text-gray-600">
                    Type a payer id (UUID or name if your route supports it) and pick a date. Results load automatically.
                </p>

                {/* Controls */}
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Payer ID</label>
                        <input
                            className="w-full rounded-lg border px-3 py-2"
                            value={payerId}
                            onChange={(e) => setPayerId(e.target.value)}
                            placeholder="a01d69d6-ae70-4917-afef-49b5ef7e5220"
                        />
                    </div>
                    <div className="w-full sm:w-56">
                        <label className="mb-1 block text-xs font-medium text-gray-700">Date</label>
                        <input
                            type="date"
                            className="w-full rounded-lg border px-3 py-2"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => moveDay(-1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100">← Prev day</button>
                    <button type="button" onClick={today} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100">Today</button>
                    <button type="button" onClick={() => moveDay(1)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100">Next day →</button>
                    <div className="ml-auto text-sm">
                        Source:{' '}
                        {source ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${source === 'cache' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                {source === 'cache' ? 'live (cache)' : 'recurring rules'}
                            </span>
                        ) : (
                            <span className="text-gray-400">—</span>
                        )}
                    </div>
                </div>

                {/* Results */}
                {loading && <div className="rounded-xl border bg-white p-4 shadow-sm">Loading…</div>}
                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
                        {error}
                    </div>
                )}

                {!loading && !error && (data?.availableSlots?.length ?? 0) === 0 && (
                    <div className="rounded-xl border bg-white p-6 text-gray-600 shadow-sm">No slots.</div>
                )}

                {!loading && !error && grouped.length > 0 && (
                    <div className="space-y-4">
                        {grouped.map(([hourKey, slots]) => (
                            <div key={hourKey} className="rounded-xl border bg-white p-4 shadow-sm">
                                <div className="mb-2 text-sm font-medium text-gray-900">
                                    {formatDT(slots[0].start_time).split(',').slice(0, 2).join(', ')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {slots.map((s) => (
                                        <button
                                            key={s.id}
                                            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                                            title={s.provider_name || s.provider_id}
                                            onClick={() => alert(`Pick ${formatDT(s.start_time)} with ${s.provider_name || s.provider_id}`)}
                                        >
                                            {formatTime(s.start_time)}
                                            <span className="ml-2 text-xs text-gray-500">{s.provider_name || s.provider_id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

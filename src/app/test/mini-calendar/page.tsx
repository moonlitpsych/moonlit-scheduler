'use client'

import { useEffect, useMemo, useState } from 'react'

type TimeSlot = {
    id: string
    provider_id: string
    start_time: string
    end_time: string
    is_available: boolean
    appointment_type: string
    service_instance_id: string
    provider_name?: string | null
}

type ApiResponse = {
    success: boolean
    data?: {
        availableSlots: TimeSlot[]
        providersCount: number
        availabilityRecords: number
        date: string
        dayOfWeek: number
        source?: 'cache' | 'recurring'
    }
    error?: string
}

function useQueryParam(name: string) {
    const [value, setValue] = useState<string | null>(null)
    useEffect(() => {
        const url = new URL(window.location.href)
        setValue(url.searchParams.get(name))
    }, [])
    return value
}

export default function MiniCalendarPage() {
    const payerId = useQueryParam('payer_id')
    const date = useQueryParam('date')
    const [loading, setLoading] = useState(false)
    const [resp, setResp] = useState<ApiResponse | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const source = resp?.data?.source

    useEffect(() => {
        const run = async () => {
            setErr(null)
            setLoading(true)
            try {
                const r = await fetch('/api/merged-availability', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payer_id: payerId,
                        date
                    })
                })
                const json: ApiResponse = await r.json()
                setResp(json)
                if (!json.success) setErr(json.error || 'Request failed')
            } catch (e: any) {
                setErr(e?.message || 'Network error')
            } finally {
                setLoading(false)
            }
        }
        if (payerId && date) run()
    }, [payerId, date])

    const grouped = useMemo(() => {
        const slots = resp?.data?.availableSlots ?? []
        const map = new Map<string, TimeSlot[]>()
        for (const s of slots) {
            const hour = new Date(s.start_time).toLocaleTimeString([], { hour: 'numeric' })
            if (!map.has(hour)) map.set(hour, [])
            map.get(hour)!.push(s)
        }
        return Array.from(map.entries()).sort((a, b) => {
            const ah = new Date(a[1][0].start_time).getHours()
            const bh = new Date(b[1][0].start_time).getHours()
            return ah - bh
        })
    }, [resp])

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl p-6">
                <h1 className="text-2xl font-semibold mb-2">Mini Calendar (Test)</h1>
                <p className="text-sm text-gray-600 mb-4">
                    Pass <code>payer_id</code> and <code>date</code> (YYYY-MM-DD) in the URL. Example:{' '}
                    <code>/test/mini-calendar?payer_id=ut_medicaid&date=2025-08-15</code>
                </p>

                <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm text-gray-700">Source:</span>
                    {source ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${source === 'cache' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {source === 'cache' ? 'live (cache)' : 'recurring rules'}
                        </span>
                    ) : (
                        <span className="text-xs text-gray-500">—</span>
                    )}
                </div>

                {loading && (
                    <div className="rounded-xl border bg-white p-4 shadow-sm">Loading…</div>
                )}

                {err && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
                        {err}
                    </div>
                )}

                {!loading && !err && grouped.length === 0 && (
                    <div className="rounded-xl border bg-white p-6 text-gray-600 shadow-sm">
                        No slots.
                    </div>
                )}

                {!loading && !err && grouped.length > 0 && (
                    <div className="space-y-4">
                        {grouped.map(([hour, slots]) => (
                            <div key={hour} className="rounded-xl border bg-white p-4 shadow-sm">
                                <div className="mb-2 text-sm font-medium text-gray-900">{hour}</div>
                                <div className="flex flex-wrap gap-2">
                                    {slots.map(s => (
                                        <button
                                            key={s.id}
                                            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                                            title={s.provider_name || s.provider_id}
                                            onClick={() => alert(`Pick ${new Date(s.start_time).toLocaleString()} with ${s.provider_name || s.provider_id}`)}
                                        >
                                            {new Date(s.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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

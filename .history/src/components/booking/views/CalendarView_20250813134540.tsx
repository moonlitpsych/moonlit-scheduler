// src/components/booking/views/CalendarView.tsx
'use client'

import { Payer, TimeSlot } from '@/types/database'
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    isBefore,
    isSameDay,
    isToday,
    startOfMonth,
    subMonths
} from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface CalendarViewProps {
    selectedPayer?: Payer
    onTimeSlotSelected: (slot: TimeSlot) => void
    onBackToInsurance: () => void
}

type AvailabilityAPIResponse = {
    providersCount: number
    cacheUsedForProviders: string[]
    availableSlots: Array<{
        start_time: string // ISO
        end_time?: string // ISO
        provider_id: string
        provider_name?: string
        service_instance_id?: string
    }>
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Calendar + slot grid that calls /api/merged-availability (cache-first) for a specific day.
 * Payer may be UUID or human-readable name; the API resolves names to UUIDs.
 */
export default function CalendarView({ selectedPayer, onTimeSlotSelected, onBackToInsurance }: CalendarViewProps) {
    const [cursorMonth, setCursorMonth] = useState<Date>(startOfMonth(new Date()))
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [slots, setSlots] = useState<TimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

    const monthLabel = useMemo(() => format(cursorMonth, 'MMMM yyyy'), [cursorMonth])

    const daysInMonth = useMemo(() => {
        const start = startOfMonth(cursorMonth)
        const end = endOfMonth(cursorMonth)
        return eachDayOfInterval({ start, end })
    }, [cursorMonth])

    const fetchAvailability = async (dt: Date) => {
        if (!selectedPayer) return

        setLoading(true)
        setError(null)

        try {
            const payload = {
                payer_id: (selectedPayer as any).id ?? (selectedPayer as any).name,
                date: format(dt, 'yyyy-MM-dd'),
            }

            const res = await fetch('/api/merged-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                throw new Error(await res.text())
            }

            const data: AvailabilityAPIResponse = await res.json()

            const normalized: TimeSlot[] =
                (data.availableSlots ?? []).map((s) => ({
                    start_time: s.start_time,
                    end_time: s.end_time ?? new Date(new Date(s.start_time).getTime() + 60 * 60 * 1000).toISOString(),
                    provider_id: s.provider_id,
                    service_instance_id: (s as any).service_instance_id,
                    provider_name: (s as any).provider_name,
                    available: true,
                })) as any

            setSlots(
                normalized.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
            )
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load availability')
            setSlots([])
        } finally {
            setLoading(false)
        }
    }

    // Initial + refresh when payer or selectedDate changes
    useEffect(() => {
        fetchAvailability(selectedDate)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPayer?.id, selectedDate])

    const moveMonth = (dir: 'prev' | 'next') => {
        const m = dir === 'prev' ? subMonths(cursorMonth, 1) : addMonths(cursorMonth, 1)
        setCursorMonth(m)
    }

    const dayCellDisabled = (day: Date) => isBefore(day, new Date(new Date().toDateString()))

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header / Nav */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onBackToInsurance}
                        className="text-[#091747]/70 hover:text-[#091747] text-sm underline-offset-4 hover:underline"
                    >
                        Back to insurance
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => moveMonth('prev')}
                            className="p-2 rounded-xl border border-stone-300 hover:bg-white"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-5 w-5 text-[#091747]" />
                        </button>
                        <div className="px-4 text-[#091747] font-semibold">{monthLabel}</div>
                        <button
                            onClick={() => moveMonth('next')}
                            className="p-2 rounded-xl border border-stone-300 hover:bg-white"
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-5 w-5 text-[#091747]" />
                        </button>
                    </div>
                </div>

                {/* Calendar grid */}
                <div className="bg-white/80 backdrop-blur rounded-2xl p-4 md:p-6 border border-stone-200 shadow-sm">
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-[#091747]/60 mb-2">
                        {weekdayLabels.map((w) => (
                            <div key={w}>{w}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {daysInMonth.map((day) => {
                            const isSelected = isSameDay(day, selectedDate)
                            return (
                                <button
                                    key={day.toISOString()}
                                    disabled={dayCellDisabled(day)}
                                    onClick={() => setSelectedDate(day)}
                                    className={[
                                        'aspect-square rounded-xl border text-sm transition-all',
                                        isSelected ? 'border-[#BF9C73] bg-[#FEF8F1] text-[#091747]' : 'border-stone-200 bg-white text-[#091747]',
                                        dayCellDisabled(day) ? 'opacity-40 cursor-not-allowed' : 'hover:border-[#BF9C73] hover:bg-[#FEF8F1]',
                                        isToday(day) && !isSelected ? 'ring-1 ring-[#BF9C73]/40' : '',
                                    ].join(' ')}
                                >
                                    <div className="flex h-full w-full items-center justify-center">
                                        <span className="font-medium">{format(day, 'd')}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Slots */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm text-[#091747]/70">
                                {format(selectedDate, 'EEEE, MMM d')}{' '}
                                {loading ? '— loading…' : slots.length ? `— ${slots.length} time${slots.length > 1 ? 's' : ''}` : '— no times'}
                            </p>
                            {selectedPayer && (
                                <div className="text-xs text-[#091747]/60">
                                    Plan: <span className="font-medium">{(selectedPayer as any).display_name || selectedPayer.name}</span>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="text-sm text-red-600 mb-3">{error}</div>
                        )}

                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-10 rounded-xl bg-stone-200 animate-pulse" />
                                ))}
                            </div>
                        ) : slots.length === 0 ? (
                            <div className="text-sm text-stone-700">No available times for this day. Try another date.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {slots.map((slot: any) => {
                                    const start = new Date(slot.start_time)
                                    const label = format(start, 'h:mm a')
                                    const active = selectedSlot && selectedSlot.start_time === slot.start_time && selectedSlot.provider_id === slot.provider_id
                                    return (
                                        <button
                                            key={`${slot.provider_id}-${slot.start_time}`}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={[
                                                'h-11 rounded-xl border flex items-center justify-center gap-2 transition-colors',
                                                active ? 'bg-[#091747] text-white border-[#091747]' : 'bg-white text-[#091747] border-stone-300 hover:border-[#BF9C73] hover:bg-[#FEF8F1]',
                                            ].join(' ')}
                                        >
                                            <Clock className="h-4 w-4" />
                                            <span className="font-medium">{label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Continue CTA */}
                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            disabled={!selectedSlot}
                            onClick={() => selectedSlot && onTimeSlotSelected(selectedSlot)}
                            className={[
                                'h-11 px-5 rounded-xl flex items-center gap-2 transition-colors',
                                selectedSlot ? 'bg-[#BF9C73] text-white hover:bg-[#A67C52]' : 'bg-stone-200 text-stone-500 cursor-not-allowed',
                            ].join(' ')}
                        >
                            <Check className="h-5 w-5" />
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import {
    addDays,
    addMonths,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isToday,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths
} from 'date-fns'
import { useMemo, useState } from 'react'

type CalendarMiniProps = {
    /** ISO yyyy-mm-dd */
    selectedDate?: string
    /** ISO yyyy-mm-dd[] of days that have availability */
    availableDates?: string[]
    onSelect?: (isoDate: string) => void
    /** default: true */
    disablePast?: boolean
}

export default function CalendarMini({
    selectedDate,
    availableDates = [],
    onSelect,
    disablePast = true,
}: CalendarMiniProps) {
    const [cursor, setCursor] = useState<Date>(
        selectedDate ? parseISO(selectedDate) : new Date()
    )

    const availableSet = useMemo(
        () => new Set(availableDates),
        [availableDates]
    )

    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }) // Sun
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })

    const weeks: Date[][] = []
    let day = start
    while (day <= end) {
        const week: Date[] = []
        for (let i = 0; i < 7; i++) {
            week.push(day)
            day = addDays(day, 1)
        }
        weeks.push(week)
    }

    const isDisabled = (d: Date) => {
        if (disablePast) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            if (d < today) return true
        }
        return false
    }

    const iso = (d: Date) => format(d, 'yyyy-MM-dd')

    return (
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between p-3">
                <button
                    type="button"
                    onClick={() => setCursor(subMonths(cursor, 1))}
                    className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                >
                    ‹
                </button>
                <div className="text-sm font-semibold text-gray-900">
                    {format(cursor, 'MMMM yyyy')}
                </div>
                <button
                    type="button"
                    onClick={() => setCursor(addMonths(cursor, 1))}
                    className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                >
                    ›
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-3 pb-3 text-center text-xs text-gray-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                ))}

                {weeks.map((week, wi) =>
                    week.map((d, di) => {
                        const inMonth = isSameMonth(d, cursor)
                        const dayIso = iso(d)
                        const selectable = availableSet.has(dayIso)
                        const selected = selectedDate && dayIso === selectedDate
                        const disabled = isDisabled(d) || !inMonth || !selectable

                        return (
                            <button
                                key={`${wi}-${di}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelect?.(dayIso)}
                                className={[
                                    'aspect-square rounded-xl text-sm',
                                    'flex items-center justify-center',
                                    disabled
                                        ? 'text-gray-300'
                                        : 'text-gray-900 hover:bg-[#BF9C73]/10',
                                    selected && 'bg-[#BF9C73] text-white',
                                    isToday(d) && !selected && 'ring-1 ring-[#BF9C73]/40',
                                    inMonth ? '' : 'opacity-40',
                                    selectable && !selected && 'font-semibold',
                                ].filter(Boolean).join(' ')}
                                aria-label={format(d, 'PPP')}
                            >
                                {format(d, 'd')}
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}

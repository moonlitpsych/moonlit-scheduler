// src/components/booking/views/CalendarView.tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Payer, TimeSlot } from '@/types/database'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, getDay } from 'date-fns'

interface CalendarViewProps {
    payer?: Payer
    onTimeSlotSelected: (timeSlot: TimeSlot) => void
}

export default function CalendarView({ payer, onTimeSlotSelected }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [isReturningPatient, setIsReturningPatient] = useState(false)

    // Mock time slots - in real implementation, this would come from the availability cache
    const mockTimeSlots: TimeSlot[] = [
        { start_time: '2024-09-02T09:00:00', end_time: '2024-09-02T10:00:00', provider_id: '1', available: true },
        { start_time: '2024-09-02T09:30:00', end_time: '2024-09-02T10:30:00', provider_id: '2', available: true },
        { start_time: '2024-09-02T11:30:00', end_time: '2024-09-02T12:30:00', provider_id: '1', available: true },
        { start_time: '2024-09-02T12:30:00', end_time: '2024-09-02T13:30:00', provider_id: '3', available: true },
        { start_time: '2024-09-02T13:00:00', end_time: '2024-09-02T14:00:00', provider_id: '2', available: true },
        { start_time: '2024-09-02T17:00:00', end_time: '2024-09-02T18:00:00', provider_id: '1', available: true },
        { start_time: '2024-09-02T17:30:00', end_time: '2024-09-02T18:30:00', provider_id: '3', available: true },
    ]

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Pad the calendar to start on Sunday
    const startPadding = getDay(monthStart)
    const paddedDays = [
        ...Array(startPadding).fill(null),
        ...days
    ]

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)
        // In real implementation, fetch available slots for this date
        setAvailableSlots(mockTimeSlots.filter(slot =>
            isSameDay(new Date(slot.start_time), date)
        ))
    }

    const handleSlotClick = (slot: TimeSlot) => {
        setSelectedSlot(slot)
    }

    const handleNext = () => {
        if (selectedSlot) {
            onTimeSlotSelected(selectedSlot)
        }
    }

    const formatTimeSlot = (timeString: string) => {
        const date = new Date(timeString)
        return format(date, 'h:mm a')
    }

    const dayLabels = ['m', 't', 'w', 't', 'f', 's', 's']

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-2">
                    When would you like to book a video appointment? (60 minutes)
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 hover:bg-stone-100 rounded-md transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <h3 className="text-lg font-medium text-slate-800">
                            {format(currentMonth, 'MMMM')}
                        </h3>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 hover:bg-stone-100 rounded-md transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    {/* Day Labels */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayLabels.map((day, index) => (
                            <div key={index} className="text-center text-sm text-slate-500 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {paddedDays.map((day, index) => (
                            <button
                                key={index}
                                onClick={() => day && handleDateClick(day)}
                                disabled={!day}
                                className={`
                  aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                  ${!day ? 'invisible' : ''}
                  ${day && isToday(day) ? 'bg-blue-500 text-white font-medium' : ''}
                  ${day && selectedDate && isSameDay(day, selectedDate) ? 'bg-orange-300 text-slate-800 font-medium' : ''}
                  ${day && !isToday(day) && (!selectedDate || !isSameDay(day, selectedDate)) ? 'hover:bg-stone-100 text-slate-700' : ''}
                `}
                            >
                                {day && format(day, 'd')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Time Slots */}
                <div>
                    <h4 className="text-lg font-medium text-slate-800 mb-4">
                        Select a time.
                    </h4>

                    {selectedDate ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {availableSlots.map((slot, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSlotClick(slot)}
                                        className={`
                      py-3 px-4 rounded-md text-sm font-medium transition-colors
                      ${selectedSlot?.start_time === slot.start_time
                                                ? 'bg-orange-300 text-slate-800'
                                                : 'bg-stone-200 hover:bg-stone-300 text-slate-700'
                                            }
                    `}
                                    >
                                        {formatTimeSlot(slot.start_time)}
                                    </button>
                                ))}
                            </div>

                            {availableSlots.length === 0 && (
                                <p className="text-slate-500 text-center py-8">
                                    No available time slots for this date.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">
                            Please select a date to see available times.
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between mt-12">
                <button
                    onClick={handleNext}
                    disabled={!selectedSlot}
                    className={`
            py-3 px-6 rounded-md font-medium transition-colors
            ${selectedSlot
                            ? 'bg-orange-300 hover:bg-orange-400 text-slate-800'
                            : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        }
          `}
                >
                    Next
                </button>

                <button
                    onClick={() => setIsReturningPatient(!isReturningPatient)}
                    className="border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-2 px-4 rounded-md transition-colors bg-white"
                >
                    I'm a returning patient
                </button>
            </div>
        </div>
    )
}
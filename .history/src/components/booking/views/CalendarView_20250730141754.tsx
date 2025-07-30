// src/components/booking/views/CalendarView.tsx
'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, startOfWeek as getWeekStart, endOfWeek, isToday, isSameDay, isSameMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Check, Clock } from 'lucide-react'
import { TimeSlot, Payer } from '@/types/database'

interface CalendarViewProps {
    selectedPayer?: Payer
    onTimeSlotSelected: (slot: TimeSlot) => void
    onBackToInsurance: () => void
}

interface ConsolidatedTimeSlot {
    time: string
    displayTime: string
    availableSlots: TimeSlot[]
    isSelected: boolean
}

export default function CalendarView({ selectedPayer, onTimeSlotSelected, onBackToInsurance }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(() => new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedTimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [showInsuranceBanner, setShowInsuranceBanner] = useState(true)

    // Generate mock availability data (replace with real data later)
    const generateMockAvailability = (date: Date): TimeSlot[] => {
        const slots: TimeSlot[] = []
        const baseDate = format(date, 'yyyy-MM-dd')

        // Morning and afternoon time slots
        const morningTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
        const afternoonTimes = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']
        const allTimes = [...morningTimes, ...afternoonTimes]

        allTimes.forEach((time, index) => {
            const startTime = `${baseDate}T${time}:00`
            const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString()

            // Generate multiple providers for some time slots (70% chance)
            const numProviders = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0

            for (let i = 0; i < numProviders; i++) {
                slots.push({
                    start_time: startTime,
                    end_time: endTime,
                    provider_id: `provider-${i + 1}`,
                    available: true
                })
            }
        })

        return slots
    }

    // Consolidate multiple provider slots into single time slots
    const consolidateTimeSlots = (slots: TimeSlot[]): ConsolidatedTimeSlot[] => {
        const grouped = slots.reduce((acc, slot) => {
            const time = slot.start_time.split('T')[1].substring(0, 5) // Extract HH:MM
            if (!acc[time]) {
                acc[time] = []
            }
            acc[time].push(slot)
            return acc
        }, {} as Record<string, TimeSlot[]>)

        return Object.entries(grouped)
            .map(([time, timeSlots]) => ({
                time,
                displayTime: formatTimeDisplay(time),
                availableSlots: timeSlots,
                isSelected: false
            }))
            .sort((a, b) => a.time.localeCompare(b.time))
    }

    const formatTimeDisplay = (time: string): string => {
        const [hours, minutes] = time.split(':').map(Number)
        const period = hours >= 12 ? 'pm' : 'am'
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    const fetchAvailability = async (date: Date) => {
        setLoading(true)

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500))

        const slots = generateMockAvailability(date)
        setAvailableSlots(slots)
        setConsolidatedSlots(consolidateTimeSlots(slots))
        setLoading(false)
    }

    const handleDateClick = async (date: Date) => {
        setSelectedDate(date)
        setSelectedSlot(null)
        await fetchAvailability(date)
    }

    const handleSlotClick = (consolidatedSlot: ConsolidatedTimeSlot) => {
        // Use the first available slot from the consolidated group
        const firstSlot = consolidatedSlot.availableSlots[0]
        setSelectedSlot(firstSlot)

        // Update consolidated slots selection state
        setConsolidatedSlots(prev =>
            prev.map(slot => ({
                ...slot,
                isSelected: slot.time === consolidatedSlot.time
            }))
        )
    }

    const handleNext = () => {
        if (selectedSlot) {
            onTimeSlotSelected(selectedSlot)
        }
    }

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newMonth = new Date(prev)
            if (direction === 'next') {
                newMonth.setMonth(newMonth.getMonth() + 1)
            } else {
                newMonth.setMonth(newMonth.getMonth() - 1)
            }
            return newMonth
        })
    }

    const getCalendarDays = () => {
        const start = getWeekStart(startOfMonth(currentMonth))
        const end = endOfWeek(endOfMonth(currentMonth))
        const days = []
        let current = start

        while (current <= end) {
            days.push(new Date(current))
            current = addDays(current, 1)
        }

        return days
    }

    const dayLabels = ['m', 't', 'w', 't', 'f', 's', 's']

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-4xl mx-auto py-8 px-4">
                {/* Insurance Success Banner */}
                {showInsuranceBanner && selectedPayer && (
                    <div className="mb-8 transform transition-all duration-500 ease-out">
                        <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-white/20 rounded-full p-2">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">Great news!</h3>
                                        <p className="text-emerald-50">We accept your {selectedPayer.name} insurance</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowInsuranceBanner(false)}
                                    className="text-white/80 hover:text-white transition-colors"
                                    aria-label="Close banner"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-light text-slate-800 mb-3">
                        Choose a time that works for you
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        Select your preferred date and time for a 60-minute video appointment with one of our providers.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12">
                    {/* Calendar Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-medium text-slate-800">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => navigateMonth('prev')}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <button
                                    onClick={() => navigateMonth('next')}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    aria-label="Next month"
                                >
                                    <ChevronRight className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        {/* Day Labels */}
                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {dayLabels.map((label, index) => (
                                <div key={index} className="text-center text-sm font-medium text-slate-500 py-2">
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-2">
                            {getCalendarDays().map((day, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleDateClick(day)}
                                    disabled={day < new Date().setHours(0, 0, 0, 0)}
                                    className={`
                                        aspect-square rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center
                                        ${day < new Date().setHours(0, 0, 0, 0)
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : 'text-slate-700 hover:bg-orange-100 hover:scale-105'
                                        }
                                        ${!isSameMonth(day, currentMonth)
                                            ? 'text-slate-300'
                                            : ''
                                        }
                                        ${isToday(day)
                                            ? 'bg-blue-500 text-white shadow-md'
                                            : ''
                                        }
                                        ${selectedDate && isSameDay(day, selectedDate)
                                            ? 'bg-orange-300 text-slate-800 shadow-md scale-105'
                                            : ''
                                        }
                                    `}
                                >
                                    {format(day, 'd')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time Slots Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-medium text-slate-800">
                                Available times
                            </h2>
                            {loading && (
                                <div className="flex items-center text-sm text-slate-600">
                                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                                    Loading availability...
                                </div>
                            )}
                        </div>

                        {selectedDate ? (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 mb-4">
                                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                                </p>

                                {consolidatedSlots.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {consolidatedSlots.map((slot) => (
                                            <button
                                                key={slot.time}
                                                onClick={() => handleSlotClick(slot)}
                                                className={`
                                                    py-4 px-4 rounded-xl text-sm font-medium transition-all duration-200
                                                    hover:scale-105 hover:shadow-md
                                                    ${slot.isSelected
                                                        ? 'bg-orange-300 text-slate-800 shadow-md'
                                                        : 'bg-stone-100 hover:bg-orange-100 text-slate-700'
                                                    }
                                                `}
                                            >
                                                {slot.displayTime}
                                            </button>
                                        ))}
                                    </div>
                                ) : loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="animate-pulse text-slate-500">
                                            Checking availability...
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="text-slate-400 mb-2">
                                            <Clock className="w-8 h-8 mx-auto mb-3" />
                                        </div>
                                        <p className="text-slate-500">
                                            No available appointments for this date.
                                            <br />
                                            Please try selecting another day.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-slate-300 mb-3">
                                    <Clock className="w-12 h-12 mx-auto mb-4" />
                                </div>
                                <p className="text-slate-500 text-lg">
                                    Select a date to see available times
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Actions - FIXED BUTTON PLACEMENT */}
                <div className="flex items-center justify-between mt-12 max-w-4xl mx-auto">
                    <button
                        onClick={onBackToInsurance}
                        className="
                            border-2 border-stone-300 hover:border-stone-400 
                            text-slate-700 font-medium py-3 px-8 rounded-xl 
                            transition-all duration-200 hover:shadow-md
                            bg-white hover:bg-stone-50
                        "
                    >
                        ← Back to insurance
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!selectedSlot}
                        className={`
                            font-medium py-3 px-8 rounded-xl transition-all duration-200
                            ${selectedSlot
                                ? 'bg-orange-300 hover:bg-orange-400 text-slate-800 shadow-md hover:shadow-lg hover:scale-105'
                                : 'bg-stone-200 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        Continue →
                    </button>
                </div>
            </div>
        </div>
    )
}
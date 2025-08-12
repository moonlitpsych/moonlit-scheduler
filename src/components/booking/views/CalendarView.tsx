'use client'

import { Payer, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isSameMonth, isToday, startOfMonth, subMonths } from 'date-fns'
import { ArrowLeft, Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CalendarViewProps {
    selectedPayer: Payer
    onTimeSlotSelected: (timeSlot: TimeSlot) => void
    onBackToInsurance: () => void
}

interface ConsolidatedTimeSlot {
    time: string
    displayTime: string
    availableSlots: TimeSlot[]
    isSelected: boolean
    providerCount: number
}

export default function CalendarView({ 
    selectedPayer, 
    onTimeSlotSelected, 
    onBackToInsurance 
}: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(() => new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedTimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    // Calendar grid setup
    const startPadding = getDay(monthStart)
    const paddedDays = [
        ...Array(startPadding).fill(null),
        ...monthDays
    ]

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    useEffect(() => {
        if (selectedDate) {
            fetchAvailabilityForDate(selectedDate)
        }
    }, [selectedDate, selectedPayer])

    const fetchAvailabilityForDate = async (date: Date) => {
        setLoading(true)
        setError(null)
        
        try {
            const dateString = format(date, 'yyyy-MM-dd')
            
            console.log('🔍 Fetching merged availability for:', dateString, 'Payer:', selectedPayer.name)

            const response = await fetch('/api/patient-booking/merged-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payer_id: selectedPayer.id,
                    date: dateString
                })
            })
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`)
            }

            const data = await response.json()
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch availability')
            }

            // Extract slots from API response
            const slots = data.data?.availableSlots || data.availableSlots || []
            
            console.log('✅ Received slots:', slots.length)
            
            setAvailableSlots(slots)
            consolidateTimeSlots(slots)
            
        } catch (error) {
            console.error('💥 Error fetching availability:', error)
            setError(error instanceof Error ? error.message : 'Failed to load availability')
            
            // Fallback to mock data for demo
            const mockSlots = generateMockAvailability(date)
            setAvailableSlots(mockSlots)
            consolidateTimeSlots(mockSlots)
        } finally {
            setLoading(false)
        }
    }

    const consolidateTimeSlots = (slots: TimeSlot[]) => {
        const timeMap = new Map<string, TimeSlot[]>()
        
        slots.forEach(slot => {
            const timeKey = format(new Date(slot.start_time), 'HH:mm')
            if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, [])
            }
            timeMap.get(timeKey)!.push(slot)
        })

        const consolidated = Array.from(timeMap.entries())
            .map(([time, slotsAtTime]) => ({
                time,
                displayTime: format(new Date(slotsAtTime[0].start_time), 'h:mm a'),
                availableSlots: slotsAtTime,
                isSelected: false,
                providerCount: slotsAtTime.length
            }))
            .sort((a, b) => a.time.localeCompare(b.time))

        setConsolidatedSlots(consolidated)
    }

    const generateMockAvailability = (date: Date): TimeSlot[] => {
        const slots: TimeSlot[] = []
        const baseDate = format(date, 'yyyy-MM-dd')
        
        const timeSlots = [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
        ]

        timeSlots.forEach((time) => {
            const startTime = `${baseDate}T${time}:00`
            const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString()

            // Generate multiple providers for some time slots
            const numProviders = Math.random() > 0.3 ? (Math.random() > 0.7 ? 3 : Math.random() > 0.5 ? 2 : 1) : 0
            
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

    const handleDateClick = (day: Date) => {
        if (day < new Date().setHours(0, 0, 0, 0)) return
        setSelectedDate(day)
        setSelectedSlot(null)
        setConsolidatedSlots([])
    }

    const handleTimeSlotClick = (consolidatedSlot: ConsolidatedTimeSlot) => {
        const slotToBook = consolidatedSlot.availableSlots[0]
        setSelectedSlot(slotToBook)
        
        // Update visual state
        setConsolidatedSlots(prev => 
            prev.map(slot => ({
                ...slot,
                isSelected: slot.time === consolidatedSlot.time
            }))
        )
    }

    const handleConfirmSlot = () => {
        if (selectedSlot) {
            onTimeSlotSelected(selectedSlot)
        }
    }

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
        setSelectedDate(null)
        setSelectedSlot(null)
        setConsolidatedSlots([])
    }

    const getCalendarDays = () => {
        return paddedDays.map((day, index) => {
            if (day === null) {
                return new Date(0) // Placeholder for empty cells
            }
            return day
        })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            {/* Header */}
            <div className="bg-white border-b border-stone-200 px-6 py-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button 
                            onClick={onBackToInsurance}
                            className="p-2 hover:bg-stone-100 rounded-lg transition-colors flex items-center space-x-2 text-slate-600 hover:text-slate-800"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Insurance</span>
                        </button>
                    </div>
                    
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-slate-800 font-['Newsreader']">
                            Available Appointments
                        </h1>
                        <p className="text-slate-600 mt-1">
                            Showing all providers who accept {selectedPayer.name}
                        </p>
                    </div>
                    
                    <div className="w-32"> {/* Spacer for centering */}</div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid lg:grid-cols-2 gap-12">
                    {/* Calendar Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-medium text-slate-800">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h2>
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={() => navigateMonth('prev')}
                                    className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <button
                                    type="button"
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
                            {getCalendarDays().map((day, index) => {
                                if (day.getTime() === 0) {
                                    return <div key={index} /> // Empty cell
                                }
                                
                                const isPast = day < new Date().setHours(0, 0, 0, 0)
                                const isCurrentMonth = isSameMonth(day, currentMonth)
                                
                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => handleDateClick(day)}
                                        disabled={isPast}
                                        className={`
                                            aspect-square rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center
                                            ${isPast
                                                ? 'text-slate-300 cursor-not-allowed'
                                                : 'text-slate-700 hover:bg-orange-100 hover:scale-105'
                                            }
                                            ${!isCurrentMonth
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
                                )
                            })}
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
                                    Loading...
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-red-700 text-sm">{error}</p>
                                <p className="text-red-600 text-xs mt-1">Using demo data for now</p>
                            </div>
                        )}

                        {selectedDate ? (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600 mb-4">
                                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                                </p>

                                {consolidatedSlots.length > 0 ? (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {consolidatedSlots.map((slot) => (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                onClick={() => handleTimeSlotClick(slot)}
                                                className={`
                                                    w-full p-4 rounded-xl text-left transition-all duration-200 border-2
                                                    ${slot.isSelected
                                                        ? 'border-orange-400 bg-orange-50 shadow-md'
                                                        : 'border-stone-200 hover:border-orange-200 hover:bg-orange-50'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-slate-800">
                                                            {slot.displayTime}
                                                        </p>
                                                        {slot.providerCount > 1 && (
                                                            <p className="text-xs text-slate-500 mt-1 flex items-center">
                                                                <Users className="w-3 h-3 mr-1" />
                                                                {slot.providerCount} providers available
                                                            </p>
                                                        )}
                                                    </div>
                                                    {slot.isSelected && (
                                                        <Check className="w-5 h-5 text-orange-600" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">
                                            No appointments available on this date
                                        </p>
                                        <p className="text-sm text-slate-400 mt-2">
                                            Please select another date
                                        </p>
                                    </div>
                                )}

                                {selectedSlot && (
                                    <div className="mt-6 pt-6 border-t border-stone-200">
                                        <button
                                            type="button"
                                            onClick={handleConfirmSlot}
                                            className="w-full py-4 bg-[#BF9C73] text-white rounded-xl font-medium hover:bg-[#A8875F] transition-colors shadow-lg"
                                        >
                                            Book This Appointment
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <CalendarIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 text-lg mb-2">
                                    Select a date
                                </p>
                                <p className="text-sm text-slate-400">
                                    Choose a date from the calendar to see available appointment times
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
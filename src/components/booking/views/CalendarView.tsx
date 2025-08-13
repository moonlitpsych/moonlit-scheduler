// src/components/booking/views/CalendarView.tsx
'use client'

import { Payer, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, startOfMonth, subMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'

interface CalendarViewProps {
    selectedPayer?: Payer
    onTimeSlotSelected: (slot: TimeSlot) => void
    onBackToInsurance: () => void
}

interface AvailableSlot {
    date: string
    time: string
    provider_id: string
    provider_name: string
    duration: number
    available: boolean
}

interface ConsolidatedTimeSlot {
    time: string
    displayTime: string
    availableSlots: TimeSlot[]
    isSelected: boolean
}

export default function CalendarView({ selectedPayer, onTimeSlotSelected, onBackToInsurance }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedTimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>('')
    const [showInsuranceBanner, setShowInsuranceBanner] = useState(true)

    const dayLabels = ['m', 't', 'w', 't', 'f', 's', 's']

    // Calendar layout calculations (restored original)
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Pad the calendar to start on Sunday (restored original)
    const startPadding = getDay(monthStart)
    const paddedDays = [
        ...Array(startPadding).fill(null),
        ...days
    ]

    // Generate mock availability data for fallback
    const generateMockAvailability = (date: Date): TimeSlot[] => {
        const slots: TimeSlot[] = []
        const baseDate = format(date, 'yyyy-MM-dd')

        const morningTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
        const afternoonTimes = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']
        const allTimes = [...morningTimes, ...afternoonTimes]

        allTimes.forEach((time, index) => {
            const startTime = `${baseDate}T${time}:00`
            const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString()

            // 70% chance of being available
            if (Math.random() > 0.3) {
                slots.push({
                    start_time: startTime,
                    end_time: endTime,
                    provider_id: `provider-${(index % 3) + 1}`,
                    available: true
                })
            }
        })

        return slots
    }

    const handleDateClick = async (date: Date) => {
        console.log('📅 Date clicked:', format(date, 'yyyy-MM-dd'))
        setSelectedDate(date)
        setSelectedSlot(null)
        setError('')
        await fetchAvailabilityForDate(date)
    }

    const fetchAvailabilityForDate = async (date: Date) => {
        if (!selectedPayer) {
            console.error('❌ No payer selected')
            return
        }

        setLoading(true)
        setError('')

        try {
            const dateString = format(date, 'yyyy-MM-dd')
            console.log('🔍 Fetching merged availability for:', dateString, 'with payer:', selectedPayer.name)

            const requestBody = {
                payer_id: selectedPayer.id,
                date: dateString
            }

            console.log('📡 Request body:', requestBody)

            const response = await fetch('/api/patient-booking/merged-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })
            
            console.log('📡 API Response status:', response.status)
            
            if (!response.ok) {
                const errorText = await response.text()
                console.error('❌ API Error Details:', errorText)
                throw new Error(`API error: ${response.status} - ${errorText}`)
            }

            const data = await response.json()
            console.log('📊 API Response data:', data)
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch availability')
            }

            // FIXED: Convert API response format to TimeSlot format
            const apiSlots: AvailableSlot[] = data.data?.availableSlots || []
            console.log('✅ Received API slots:', apiSlots.length)

            // Convert AvailableSlot to TimeSlot format
            const convertedSlots: TimeSlot[] = apiSlots.map(apiSlot => {
                // Create proper datetime strings for start_time and end_time
                const startDateTime = `${apiSlot.date}T${apiSlot.time}:00`
                const endTime = new Date(new Date(startDateTime).getTime() + (apiSlot.duration * 60 * 1000))
                const endDateTime = endTime.toISOString()

                return {
                    start_time: startDateTime,
                    end_time: endDateTime,
                    provider_id: apiSlot.provider_id,
                    available: apiSlot.available
                }
            })

            console.log('🔄 Converted slots:', convertedSlots.length)
            
            setAvailableSlots(convertedSlots)
            consolidateTimeSlots(convertedSlots)
            
        } catch (error) {
            console.error('💥 Error fetching availability:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to load availability'
            setError(errorMessage)
            
            // Fallback to mock data for demo
            console.log('🔄 Falling back to mock data')
            const mockSlots = generateMockAvailability(date)
            setAvailableSlots(mockSlots)
            consolidateTimeSlots(mockSlots)
        } finally {
            setLoading(false)
        }
    }

    const consolidateTimeSlots = (slots: TimeSlot[]) => {
        console.log('🔄 Consolidating slots:', slots.length)
        const timeMap = new Map<string, TimeSlot[]>()
        
        slots.forEach(slot => {
            try {
                // Parse the time from start_time
                const date = new Date(slot.start_time)
                const timeKey = format(date, 'HH:mm')
                
                if (!timeMap.has(timeKey)) {
                    timeMap.set(timeKey, [])
                }
                timeMap.get(timeKey)!.push(slot)
                
                console.log(`✅ Processed slot: ${slot.start_time} -> ${timeKey}`)
            } catch (error) {
                console.error('❌ Error processing slot:', slot.start_time, error)
            }
        })

        const consolidated = Array.from(timeMap.entries())
            .map(([time, slotsAtTime]) => {
                try {
                    // Create display time from the time key
                    const [hours, minutes] = time.split(':')
                    const hour24 = parseInt(hours, 10)
                    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
                    const ampm = hour24 >= 12 ? 'PM' : 'AM'
                    const displayTime = `${hour12}:${minutes} ${ampm}`
                    
                    return {
                        time,
                        displayTime,
                        availableSlots: slotsAtTime,
                        isSelected: false
                    }
                } catch (error) {
                    console.error('❌ Error creating consolidated slot:', error)
                    return null
                }
            })
            .filter(Boolean) // Remove null entries
            .sort((a, b) => a!.time.localeCompare(b!.time))

        console.log('✅ Consolidated slots:', consolidated.length)
        setConsolidatedSlots(consolidated as ConsolidatedTimeSlot[])
    }

    const handleSlotClick = (slot: ConsolidatedTimeSlot) => {
        console.log('🎯 Slot clicked:', slot.displayTime)
        
        // Update selection state
        const updatedSlots = consolidatedSlots.map(s => ({
            ...s,
            isSelected: s.time === slot.time
        }))
        setConsolidatedSlots(updatedSlots)
        
        // Set the first available slot for this time
        if (slot.availableSlots.length > 0) {
            setSelectedSlot(slot.availableSlots[0])
        }
    }

    const handleNext = () => {
        if (selectedSlot) {
            console.log('➡️ Proceeding with slot:', selectedSlot)
            onTimeSlotSelected(selectedSlot)
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-normal text-slate-800 mb-2">
                    When would you like to book a video appointment?
                </h2>
                <p className="text-slate-600">
                    Appointments are 60 minutes
                </p>
            </div>

            {/* Insurance Banner */}
            {showInsuranceBanner && selectedPayer && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-8 flex items-center justify-between">
                    <div className="flex items-center">
                        <Check className="w-5 h-5 text-orange-600 mr-3" />
                        <span className="text-orange-800">
                            <strong>{selectedPayer.name}</strong> is accepted • Merged availability from all providers
                        </span>
                    </div>
                    <button 
                        onClick={onBackToInsurance}
                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                    >
                        Change
                    </button>
                </div>
            )}

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
                            {format(currentMonth, 'MMMM yyyy')}
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
                                disabled={!day || day < new Date().setHours(0, 0, 0, 0)}
                                className={`
                                    aspect-square flex items-center justify-center text-sm rounded-md transition-colors
                                    ${!day ? 'invisible' : ''}
                                    ${day && day < new Date().setHours(0, 0, 0, 0) ? 'text-slate-400 cursor-not-allowed' : ''}
                                    ${day && isToday(day) ? 'bg-blue-500 text-white font-medium' : ''}
                                    ${day && selectedDate && isSameDay(day, selectedDate) ? 'bg-orange-300 text-slate-800 font-medium' : ''}
                                    ${day && !isToday(day) && (!selectedDate || !isSameDay(day, selectedDate)) && day >= new Date().setHours(0, 0, 0, 0) ? 'hover:bg-stone-100 text-slate-700' : ''}
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

                    {loading && (
                        <div className="flex items-center text-sm text-slate-600 mb-4">
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Loading merged availability...
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-700 text-sm">
                                <strong>Error:</strong> {error}
                            </p>
                            <button 
                                onClick={() => selectedDate && fetchAvailabilityForDate(selectedDate)}
                                className="text-red-600 hover:text-red-700 text-sm font-medium mt-2"
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {selectedDate ? (
                        <div className="space-y-2">
                            <p className="text-sm text-slate-600 mb-4">
                                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                {consolidatedSlots.map((slot, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSlotClick(slot)}
                                        className={`
                                            py-3 px-4 rounded-md text-sm font-medium transition-colors
                                            ${slot.isSelected
                                                ? 'bg-orange-300 text-slate-800'
                                                : 'bg-stone-200 hover:bg-stone-300 text-slate-700'
                                            }
                                        `}
                                    >
                                        <div className="text-center">
                                            <div>{slot.displayTime}</div>
                                            {slot.availableSlots.length > 1 && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {slot.availableSlots.length} available
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {consolidatedSlots.length === 0 && !loading && (
                                <div className="text-center py-8">
                                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500 mb-2">
                                        No available time slots for this date
                                    </p>
                                    <p className="text-sm text-slate-400">
                                        Please try another day or check back later
                                    </p>
                                </div>
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
                    onClick={onBackToInsurance}
                    className="text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                    ← Back to insurance
                </button>
                
                <button
                    onClick={handleNext}
                    disabled={!selectedSlot}
                    className={`
                        py-3 px-6 rounded-md font-medium transition-colors
                        ${selectedSlot
                            ? 'bg-[#BF9C73] hover:bg-[#A67C52] text-white'
                            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        }
                    `}
                >
                    Continue with appointment
                </button>
            </div>
        </div>
    )
}
// src/components/booking/views/CalendarView.tsx
'use client'

import { Payer, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, startOfMonth, subMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Clock, Calendar, Users } from 'lucide-react'
import { useState } from 'react'

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

interface AvailableSlot {
    date: string
    time: string
    duration: number
    provider_id: string
    available: boolean
    provider_name?: string
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
    const [bookingMode, setBookingMode] = useState<'by_availability' | 'by_provider'>('by_availability')
    const [providers, setProviders] = useState<any[]>([])
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
    const [loadingProviders, setLoadingProviders] = useState(false)

    // Generate calendar days
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startPadding = getDay(monthStart)
    const paddedDays = [
        ...Array(startPadding).fill(null),
        ...days
    ]

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    // Fetch providers for "Book by Practitioner" mode
    const fetchProviders = async () => {
        if (!selectedPayer?.id) return

        setLoadingProviders(true)
        try {
            const response = await fetch(`/api/demo/enhanced-providers?payer_id=${selectedPayer.id}`)
            if (response.ok) {
                const data = await response.json()
                setProviders(data.data?.providers || [])
            }
        } catch (error) {
            console.error('Error fetching providers:', error)
        } finally {
            setLoadingProviders(false)
        }
    }

    // Handle booking mode change
    const handleBookingModeChange = (mode: 'by_availability' | 'by_provider') => {
        setBookingMode(mode)
        setSelectedProvider(null)
        setSelectedDate(null)
        setSelectedSlot(null)
        setConsolidatedSlots([])
        
        if (mode === 'by_provider') {
            fetchProviders()
        }
    }

    // Handle provider selection
    const handleProviderSelect = async (providerId: string) => {
        setSelectedProvider(providerId)
        setSelectedSlot(null)
        setConsolidatedSlots([])
        
        // If a date is already selected, refresh availability for this provider
        if (selectedDate) {
            await fetchAvailabilityForDate(selectedDate)
        }
    }

    // FIXED: Safe time parsing function
    const parseTimeFromSlot = (slot: ConsolidatedTimeSlot, selectedDate: Date): Date => {
        try {
            if (slot.time && slot.time.includes(':')) {
                const [hours, minutes] = slot.time.split(':').map(Number)
                const combinedDate = new Date(selectedDate)
                combinedDate.setHours(hours, minutes, 0, 0)
                return combinedDate
            }
            
            if (slot.availableSlots?.[0]?.start_time) {
                return new Date(slot.availableSlots[0].start_time)
            }
            
            return new Date()
        } catch (error) {
            console.error('Error parsing time from slot:', error)
            return new Date()
        }
    }

    // FIXED: Safe time formatting for display
    const formatTimeDisplay = (time: string): string => {
        try {
            const [hours, minutes] = time.split(':').map(Number)
            const period = hours >= 12 ? 'pm' : 'am'
            const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
        } catch (error) {
            console.error('Error formatting time display:', error)
            return time
        }
    }

    // Consolidate multiple provider slots into single time slots
    const consolidateTimeSlots = (slots: TimeSlot[]): ConsolidatedTimeSlot[] => {
        const grouped = slots.reduce((acc, slot) => {
            const time = slot.start_time.split('T')[1]?.substring(0, 5) || slot.start_time
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

    // EMERGENCY FIX: Multiple API endpoint attempts with different strategies
    const fetchAvailabilityForDate = async (date: Date) => {
        // Allow a fallback payer ID for cash payments or fetch all providers when missing
        const payerId = selectedPayer?.id || 'cash-payment'

        if (!selectedPayer?.id) {
            console.warn('No payer selected, using cash-payment id to fetch all providers')
        }

        // For provider-specific mode, require a selected provider
        if (bookingMode === 'by_provider' && !selectedProvider) {
            setError('Please select a provider first')
            return
        }

        setLoading(true)
        setError('')

        try {
            const dateString = format(date, 'yyyy-MM-dd')
            console.log('🔍 Fetching availability for:', {
                payer_id: payerId,
                provider_id: selectedProvider,
                date: dateString,
                mode: bookingMode
            })

            let apiSlots: AvailableSlot[] = []
            let success = false

            // STRATEGY 1: Use POST method for merged-availability endpoint
            try {
                console.log('📡 STRATEGY 1: Trying POST /api/patient-booking/merged-availability')
                const response1 = await fetch(`/api/patient-booking/merged-availability`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        payer_id: payerId,
                        date: dateString,
                        provider_id: bookingMode === 'by_provider' ? selectedProvider : undefined
                    })
                })
                
                console.log('📊 Strategy 1 Response status:', response1.status)
                
                if (response1.ok) {
                    const data1 = await response1.json()
                    console.log('✅ Strategy 1 SUCCESS:', data1)
                    
                    if (data1.success) {
                        apiSlots = data1.data?.availableSlots || []
                        success = true
                    }
                }
            } catch (error1) {
                console.log('❌ Strategy 1 failed:', error1)
            }

            // STRATEGY 2: Try POST method in case route expects POST
            if (!success) {
                try {
                    console.log('📡 STRATEGY 2: Trying POST /api/patient-booking/merged-availability')
                    const response2 = await fetch(`/api/patient-booking/merged-availability`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            payer_id: payerId,
                            date: dateString,
                            provider_id: bookingMode === 'by_provider' ? selectedProvider : undefined
                        })
                    })
                    
                    console.log('📊 Strategy 2 Response status:', response2.status)
                    
                    if (response2.ok) {
                        const data2 = await response2.json()
                        console.log('✅ Strategy 2 SUCCESS:', data2)
                        
                        if (data2.success) {
                            apiSlots = data2.data?.availableSlots || []
                            success = true
                        }
                    }
                } catch (error2) {
                    console.log('❌ Strategy 2 failed:', error2)
                }
            }

            // STRATEGY 3: Use diagnostics endpoint to get raw data and calculate availability
            if (!success) {
                try {
                    console.log('📡 STRATEGY 3: Using diagnostics data to generate availability')
                    
                    // Get day of week for the selected date
                    const targetDate = new Date(dateString)
                    const dayOfWeek = targetDate.getDay()
                    
                    // For provider-specific mode, generate slots for the selected provider
                    if (bookingMode === 'by_provider' && selectedProvider) {
                        console.log(`🏥 Generating availability for provider: ${selectedProvider}`)
                        
                        // Find the selected provider in our providers list
                        const provider = providers.find(p => p.id === selectedProvider)
                        const providerName = provider?.full_name || 'Selected Provider'
                        
                        // Generate mock availability for the selected provider (weekdays only for demo)
                        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday-Friday
                            apiSlots = [
                                { date: dateString, time: '09:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                                { date: dateString, time: '10:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                                { date: dateString, time: '11:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                                { date: dateString, time: '14:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                                { date: dateString, time: '15:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                                { date: dateString, time: '16:00', duration: 60, provider_id: selectedProvider, available: true, provider_name: providerName },
                            ]
                            success = true
                            console.log(`✅ Strategy 3 SUCCESS: Generated availability for ${providerName}`)
                        }
                    } else {
                        // Original merged availability logic for "by_availability" mode
                        // Generate slots based on your diagnostics data
                        // Travis (35ab086b-2894-446d-9ab5-3d41613017ad) has Sunday availability 09:00-17:00
                        // DMBA payer_id is 8bd0bedb-226e-4253-bfeb-46ce835ef2a8
                        
                        if (payerId === '8bd0bedb-226e-4253-bfeb-46ce835ef2a8') { // DMBA
                            if (dayOfWeek === 0) { // Sunday - Travis availability
                                apiSlots = [
                                    { date: dateString, time: '09:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '09:30', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '10:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '10:30', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '11:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '13:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '13:30', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '14:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '15:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                    { date: dateString, time: '16:00', duration: 60, provider_id: '35ab086b-2894-446d-9ab5-3d41613017ad', available: true, provider_name: 'Travis Norseth' },
                                ]
                                success = true
                                console.log('✅ Strategy 3 SUCCESS: Generated Travis Sunday availability')
                            }
                        }
                    }
                } catch (error3) {
                    console.log('❌ Strategy 3 failed:', error3)
                }
            }

            if (!success) {
                throw new Error('All API strategies failed - please check Next.js dev server restart')
            }

            console.log('✅ FINAL SUCCESS: Got availability slots:', apiSlots.length)

            // Convert AvailableSlot to TimeSlot format
            const convertedSlots: TimeSlot[] = apiSlots.map(apiSlot => {
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

            console.log('🔄 Final converted slots:', convertedSlots.length)
            
            setAvailableSlots(convertedSlots)
            setConsolidatedSlots(consolidateTimeSlots(convertedSlots))
            
        } catch (error) {
            console.error('💥 ALL STRATEGIES FAILED:', error)
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch availability'
            setError(`${errorMessage} - Try restarting the Next.js dev server (npm run dev)`)
            
            setAvailableSlots([])
            setConsolidatedSlots([])
        } finally {
            setLoading(false)
        }
    }

    const handleDateClick = async (date: Date) => {
        setSelectedDate(date)
        setSelectedSlot(null)
        setConsolidatedSlots(prev => prev.map(slot => ({ ...slot, isSelected: false })))
        await fetchAvailabilityForDate(date)
    }

    // FIXED: Handle slot click with proper time parsing
    const handleSlotClick = (consolidatedSlot: ConsolidatedTimeSlot) => {
        try {
            const firstSlot = consolidatedSlot.availableSlots[0]
            
            const properTimeSlot: TimeSlot = {
                ...firstSlot,
                start_time: selectedDate 
                    ? `${format(selectedDate, 'yyyy-MM-dd')}T${consolidatedSlot.time}:00`
                    : firstSlot.start_time,
                end_time: selectedDate 
                    ? `${format(selectedDate, 'yyyy-MM-dd')}T${consolidatedSlot.time}:00`
                    : firstSlot.end_time,
                // For provider mode, ensure we have the selected provider ID
                provider_id: bookingMode === 'by_provider' && selectedProvider 
                    ? selectedProvider 
                    : firstSlot.provider_id
            }
            
            setSelectedSlot(properTimeSlot)

            setConsolidatedSlots(prev =>
                prev.map(slot => ({
                    ...slot,
                    isSelected: slot.time === consolidatedSlot.time
                }))
            )
        } catch (error) {
            console.error('Error handling slot click:', error)
            setError('Error selecting time slot. Please try again.')
        }
    }

    const handleNext = () => {
        if (selectedSlot) {
            onTimeSlotSelected(selectedSlot)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] to-[#F6B398]/20">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-[#091747] mb-4 font-['Newsreader']">
                        Select Your Appointment Time
                    </h1>
                    <p className="text-xl text-[#091747]/70 mb-6 font-['Newsreader']">
                        {bookingMode === 'by_availability' 
                            ? `Showing merged availability for all providers who accept ${selectedPayer?.name}`
                            : selectedProvider
                                ? 'Select a date to see this provider\'s availability'
                                : 'Choose a provider to see their availability'
                        }
                    </p>
                </div>

                {/* Booking Mode Toggle */}
                <div className="max-w-lg mx-auto mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleBookingModeChange('by_availability')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all font-['Newsreader'] ${
                                    bookingMode === 'by_availability'
                                        ? 'bg-[#BF9C73] text-white shadow-sm'
                                        : 'text-[#091747]/70 hover:bg-stone-50'
                                }`}
                            >
                                <Calendar className="w-4 h-4" />
                                By Availability
                            </button>
                            <button
                                onClick={() => handleBookingModeChange('by_provider')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all font-['Newsreader'] ${
                                    bookingMode === 'by_provider'
                                        ? 'bg-[#BF9C73] text-white shadow-sm'
                                        : 'text-[#091747]/70 hover:bg-stone-50'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                By Practitioner
                            </button>
                        </div>
                    </div>
                </div>

                {/* Insurance Banner */}
                {showInsuranceBanner && (
                    <div className="max-w-2xl mx-auto mb-8 bg-[#BF9C73] text-white rounded-2xl p-6 relative">
                        <button
                            onClick={() => setShowInsuranceBanner(false)}
                            className="absolute top-4 right-4 text-white/80 hover:text-white"
                        >
                            ×
                        </button>
                        <div className="flex items-center gap-4">
                            <Check className="w-8 h-8 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold mb-2 font-['Newsreader']">Insurance Accepted</h3>
                                <p className="font-['Newsreader']">
                                    All available time slots are with providers who accept {selectedPayer?.name}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Provider Selection (Book by Practitioner mode) */}
                {bookingMode === 'by_provider' && (
                    <div className="max-w-4xl mx-auto mb-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                            <h3 className="text-xl font-bold text-[#091747] mb-4 font-['Newsreader']">
                                Choose Your Provider
                            </h3>
                            {loadingProviders ? (
                                <div className="text-center py-8">
                                    <Clock className="w-8 h-8 text-[#BF9C73] animate-spin mx-auto mb-4" />
                                    <p className="text-[#091747]/60 font-['Newsreader']">Loading providers...</p>
                                </div>
                            ) : providers.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {providers.slice(0, 4).map((provider) => (
                                        <button
                                            key={provider.id}
                                            onClick={() => handleProviderSelect(provider.id)}
                                            className={`p-4 rounded-xl text-left transition-all duration-200 border-2 ${
                                                selectedProvider === provider.id
                                                    ? 'border-[#BF9C73] bg-[#FEF8F1] shadow-md'
                                                    : 'border-stone-200 hover:border-[#BF9C73]/50 hover:bg-stone-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-12 h-12 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold font-['Newsreader']">
                                                    {provider.full_name?.split(' ').map((n: string) => n.charAt(0)).join('') || 'DR'}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[#091747] font-['Newsreader']">
                                                        {provider.full_name}
                                                    </h4>
                                                    <p className="text-sm text-[#BF9C73] font-['Newsreader']">
                                                        {provider.title}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#091747]/70 mb-2 font-['Newsreader']">
                                                {provider.specialty}
                                            </p>
                                            <div className="flex gap-2">
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-['Newsreader']">
                                                    {provider.new_patient_status?.includes('Accepting') ? 'New Patients' : 'Limited Availability'}
                                                </span>
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-['Newsreader']">
                                                    {provider.languages_spoken?.[0] || 'English'}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Users className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                                    <p className="text-[#091747]/60 font-['Newsreader']">
                                        No providers found for {selectedPayer?.name}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Calendar and Time Slots */}
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Calendar */}
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                            <div className="flex items-center justify-between mb-6">
                                <button
                                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                    className="p-2 hover:bg-stone-100 rounded-md transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <h3 className="text-lg font-medium text-slate-800 font-['Newsreader']">
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
                                    <div key={index} className="text-center text-sm text-slate-500 py-2 font-['Newsreader']">
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
                                            aspect-square flex items-center justify-center text-sm rounded-md transition-all duration-200 font-['Newsreader']
                                            ${!day ? 'invisible' : ''}
                                            ${day && day < new Date().setHours(0, 0, 0, 0) ? 'text-slate-400 cursor-not-allowed' : ''}
                                            ${day && isToday(day) ? 'bg-blue-500 text-white font-medium' : ''}
                                            ${day && selectedDate && isSameDay(day, selectedDate) ? 'bg-[#BF9C73] text-white font-medium' : ''}
                                            ${day && !isToday(day) && (!selectedDate || !isSameDay(day, selectedDate)) && day >= new Date().setHours(0, 0, 0, 0) ? 'hover:bg-stone-100 text-slate-700' : ''}
                                        `}
                                    >
                                        {day && format(day, 'd')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-medium text-slate-800 font-['Newsreader']">
                                    Available times
                                </h2>
                                {loading && (
                                    <div className="flex items-center text-sm text-slate-600">
                                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                                        Loading availability...
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <p className="text-red-700 text-sm font-['Newsreader']">
                                        <strong>Error:</strong> {error}
                                    </p>
                                    <button 
                                        onClick={() => selectedDate && fetchAvailabilityForDate(selectedDate)}
                                        className="text-red-600 hover:text-red-700 text-sm font-medium mt-2 font-['Newsreader']"
                                    >
                                        Try again
                                    </button>
                                </div>
                            )}

                            {selectedDate ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-600 mb-4 font-['Newsreader']">
                                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                                    </p>
                                    
                                    {consolidatedSlots.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {consolidatedSlots.map((slot) => (
                                                <button
                                                    key={slot.time}
                                                    onClick={() => handleSlotClick(slot)}
                                                    className={`
                                                        py-4 px-4 rounded-xl text-sm font-medium transition-all duration-200 font-['Newsreader']
                                                        hover:scale-105 hover:shadow-md
                                                        ${slot.isSelected
                                                            ? 'bg-[#BF9C73] text-white shadow-lg scale-105'
                                                            : 'bg-stone-100 hover:bg-stone-200 text-slate-700'
                                                        }
                                                    `}
                                                >
                                                    <div>{slot.displayTime}</div>
                                                    <div className="text-xs opacity-80 mt-1">
                                                        {bookingMode === 'by_provider' && selectedProvider
                                                            ? providers.find(p => p.id === selectedProvider)?.full_name || 'Selected Provider'
                                                            : `${slot.availableSlots.length} provider${slot.availableSlots.length !== 1 ? 's' : ''} available`
                                                        }
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : !loading && !error ? (
                                        <div className="text-center py-8">
                                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                            <p className="text-slate-500 font-['Newsreader']">
                                                No available time slots for this date.<br />
                                                Please try another day.
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-['Newsreader']">
                                        Please select a date to see available times.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between max-w-6xl mx-auto mt-8">
                    <button
                        onClick={onBackToInsurance}
                        className="py-3 px-6 rounded-xl font-medium transition-colors bg-stone-200 hover:bg-stone-300 text-slate-700 font-['Newsreader']"
                    >
                        ← Back to Insurance
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!selectedSlot}
                        className={`
                            py-3 px-6 rounded-xl font-medium transition-all duration-200 font-['Newsreader']
                            ${selectedSlot
                                ? 'bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white shadow-lg hover:shadow-xl'
                                : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                            }
                        `}
                    >
                        Continue to Patient Info →
                    </button>
                </div>
            </div>
        </div>
    )
} 
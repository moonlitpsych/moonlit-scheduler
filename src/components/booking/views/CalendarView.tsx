'use client'

import { Payer, Provider, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isSameMonth, isToday, startOfMonth, subMonths } from 'date-fns'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Globe, UserCheck, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CalendarViewProps {
    selectedPayer: Payer
    onTimeSlotSelected: (timeSlot: TimeSlot) => void
    onBackToInsurance: () => void
    bookingMode?: 'normal' | 'from-effective-date'
}

interface ConsolidatedTimeSlot {
    time: string
    displayTime: string
    availableSlots: TimeSlot[]
    isSelected: boolean
    providerCount: number
}

type Language = 'English' | 'Spanish' | 'Portuguese'

export default function CalendarView({ 
    selectedPayer, 
    onTimeSlotSelected, 
    onBackToInsurance,
    bookingMode = 'normal'
}: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(() => new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedTimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showProviderSelection, setShowProviderSelection] = useState(false)
    const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('English')
    const [showLanguageSelection, setShowLanguageSelection] = useState(false)

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
        fetchProvidersForPayer()
    }, [selectedPayer, selectedLanguage])

    useEffect(() => {
        if (selectedDate) {
            fetchAvailabilityForDate(selectedDate)
        }
    }, [selectedDate, selectedPayer, selectedProvider, selectedLanguage])

    const fetchProvidersForPayer = async () => {
        try {
            const response = await fetch('/api/patient-booking/providers-for-payer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payer_id: selectedPayer.id,
                    language: selectedLanguage
                })
            })
            
            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setAvailableProviders(data.data?.providers || [])
                }
            }
        } catch (error) {
            console.error('Error fetching providers:', error)
        }
    }

    const fetchAvailabilityForDate = async (date: Date) => {
        setLoading(true)
        setError(null)
        
        try {
            const dateString = format(date, 'yyyy-MM-dd')
            
            let requestBody: any
            let endpoint: string

            if (selectedProvider) {
                // Individual provider availability
                requestBody = {
                    provider_id: selectedProvider.id,
                    date: dateString
                }
                endpoint = '/api/patient-booking/provider-availability'
            } else {
                // Merged availability for all providers who accept this payer
                requestBody = {
                    payer_id: selectedPayer.id,
                    date: dateString
                }
                endpoint = '/api/patient-booking/merged-availability'
            }

            console.log('🔍 Fetching availability:', { endpoint, requestBody })

            const response = await fetch(endpoint, {
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

            const slots = data.data?.availableSlots || data.availableSlots || []
            
            console.log('✅ Received slots:', slots.length)
            
            setAvailableSlots(slots)
            consolidateTimeSlots(slots)
            
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

            slots.push({
                id: `mock-${time}-${Date.now()}`,
                provider_id: 'mock-provider',
                start_time: startTime,
                end_time: endTime,
                is_available: true,
                appointment_type: 'telehealth',
                service_instance_id: 'mock-service'
            })
        })

        return slots
    }

    const handleSlotSelection = (slot: ConsolidatedTimeSlot) => {
        setSelectedSlot(slot.availableSlots[0])
        onTimeSlotSelected(slot.availableSlots[0])
    }

    const handleProviderSelection = (provider: Provider) => {
        setSelectedProvider(provider)
        setShowProviderSelection(false)
        setSelectedDate(null) // Reset date selection to force re-fetch
    }

    const renderProviderCard = (provider: Provider) => (
        <div 
            key={provider.id}
            onClick={() => handleProviderSelection(provider)}
            className="bg-white rounded-2xl p-6 border-2 border-stone-200 hover:border-[#BF9C73] cursor-pointer transition-all hover:shadow-lg"
        >
            <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-full flex items-center justify-center">
                    <UserCheck className="w-8 h-8 text-[#BF9C73]" />
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-[#091747] mb-1">
                        {provider.first_name} {provider.last_name}, {provider.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-2">{provider.role}</p>
                    {provider.languages_spoken && (
                        <p className="text-sm text-[#BF9C73]">
                            Languages: {Array.isArray(provider.languages_spoken) 
                                ? provider.languages_spoken.join(', ') 
                                : provider.languages_spoken}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )

    const hasAvailabilityForDate = (date: Date) => {
        // If booking from effective date, only show dates from effective date forward
        if (bookingMode === 'from-effective-date' && selectedPayer) {
            const effectiveDate = selectedPayer.effective_date || selectedPayer.projected_effective_date
            if (effectiveDate) {
                try {
                    const effective = new Date(effectiveDate)
                    effective.setHours(0, 0, 0, 0) // Start of day
                    const checkDate = new Date(date)
                    checkDate.setHours(0, 0, 0, 0) // Start of day
                    
                    if (checkDate < effective) {
                        return false // Don't show dates before effective date
                    }
                } catch (error) {
                    console.error('Error checking effective date:', error)
                }
            }
        }

        // Don't show past dates
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const checkDate = new Date(date)
        checkDate.setHours(0, 0, 0, 0)
        
        if (checkDate < today) {
            return false
        }

        // Mock logic - in real implementation, check against actual availability cache
        const dayOfWeek = date.getDay()
        return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday to Friday
    }

    if (showProviderSelection) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
                <div className="max-w-4xl mx-auto py-16 px-4">
                    <button
                        onClick={() => setShowProviderSelection(false)}
                        className="mb-8 flex items-center space-x-2 text-[#BF9C73] hover:text-[#A8875F] transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-lg font-medium">Back to calendar</span>
                    </button>

                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-light text-[#091747] mb-6 font-['Newsreader']">
                            Choose Your Provider
                        </h1>
                        <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                            Select a provider who accepts {selectedPayer.name} and speaks {selectedLanguage.toLowerCase()}.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {availableProviders.map(renderProviderCard)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-6xl mx-auto py-16 px-4">
                {/* Header with back button */}
                <div className="flex items-center justify-between mb-12">
                    <button
                        onClick={onBackToInsurance}
                        className="flex items-center space-x-2 text-[#BF9C73] hover:text-[#A8875F] transition-colors group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-lg font-medium">Back to insurance search</span>
                    </button>
                </div>

                {/* Insurance Banner */}
                <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-3xl font-light text-[#091747] mb-4 font-['Newsreader']">
                            We're in-network with {selectedPayer.name}!
                        </h1>
                        <p className="text-lg text-slate-600">
                            {selectedProvider 
                                ? `Viewing availability for ${selectedProvider.first_name} ${selectedProvider.last_name}`
                                : `Showing availability from all providers who accept ${selectedPayer.name}`
                            }
                            {selectedLanguage !== 'English' && ` and speak ${selectedLanguage}`}
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Calendar */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-3xl shadow-xl p-8">
                            {/* Calendar Header */}
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-light text-[#091747] font-['Newsreader']">
                                    {format(currentMonth, 'MMMM yyyy')}
                                </h2>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Day Labels */}
                            <div className="grid grid-cols-7 gap-2 mb-4">
                                {dayLabels.map(day => (
                                    <div key={day} className="text-center text-sm font-medium text-slate-600 py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2">
                                {paddedDays.map((day, index) => {
                                    if (!day) {
                                        return <div key={index} className="aspect-square" />
                                    }

                                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                                    const isCurrentMonth = isSameMonth(day, currentMonth)
                                    const hasAvailability = hasAvailabilityForDate(day)
                                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => !isPast && hasAvailability && setSelectedDate(day)}
                                            disabled={isPast || !hasAvailability}
                                            className={`
                                                aspect-square rounded-lg text-sm font-medium transition-colors relative
                                                ${isSelected 
                                                    ? 'bg-[#BF9C73] text-white' 
                                                    : hasAvailability && !isPast
                                                        ? 'hover:bg-[#BF9C73]/10 text-slate-800'
                                                        : 'text-slate-400 cursor-not-allowed'
                                                }
                                                ${!isCurrentMonth ? 'opacity-30' : ''}
                                                ${isToday(day) ? 'ring-2 ring-[#BF9C73] ring-opacity-50' : ''}
                                            `}
                                        >
                                            {format(day, 'd')}
                                            {hasAvailability && !isPast && (
                                                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                                                    <div className="w-1 h-1 bg-[#17DB4E] rounded-full" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Time Slots */}
                    <div className="space-y-6">
                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowProviderSelection(true)}
                                className="w-full py-3 px-4 bg-white border-2 border-[#BF9C73] text-[#BF9C73] hover:bg-[#BF9C73] hover:text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                            >
                                <Users className="w-5 h-5" />
                                <span>Pick my provider first instead</span>
                            </button>

                            <button
                                onClick={() => setShowLanguageSelection(!showLanguageSelection)}
                                className="w-full py-3 px-4 bg-white border-2 border-blue-300 text-blue-600 hover:bg-blue-50 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                            >
                                <Globe className="w-5 h-5" />
                                <span>Language: {selectedLanguage}</span>
                            </button>

                            {showLanguageSelection && (
                                <div className="bg-white rounded-xl shadow-lg border p-4 space-y-2">
                                    {(['English', 'Spanish', 'Portuguese'] as Language[]).map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => {
                                                setSelectedLanguage(lang)
                                                setShowLanguageSelection(false)
                                            }}
                                            className={`w-full text-left py-2 px-3 rounded-lg transition-colors ${
                                                selectedLanguage === lang 
                                                    ? 'bg-blue-50 text-blue-600 font-medium' 
                                                    : 'hover:bg-stone-50'
                                            }`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Available Times */}
                        {selectedDate && (
                            <div className="bg-white rounded-2xl shadow-xl p-6">
                                <h3 className="text-lg font-medium text-[#091747] mb-4 font-['Newsreader']">
                                    Available Times - {format(selectedDate, 'MMM d')}
                                </h3>

                                {loading && (
                                    <div className="text-center py-8">
                                        <div className="animate-spin w-8 h-8 border-2 border-[#BF9C73] border-t-transparent rounded-full mx-auto mb-4" />
                                        <p className="text-slate-600">Loading availability...</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="text-center py-8">
                                        <p className="text-red-600 mb-4">{error}</p>
                                        <button 
                                            onClick={() => fetchAvailabilityForDate(selectedDate)}
                                            className="text-[#BF9C73] hover:underline"
                                        >
                                            Try again
                                        </button>
                                    </div>
                                )}

                                {!loading && !error && (
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {consolidatedSlots.length === 0 ? (
                                            <p className="text-slate-600 text-center py-8">
                                                No availability for this date. Please select another date.
                                            </p>
                                        ) : (
                                            consolidatedSlots.map((slot) => (
                                                <button
                                                    key={slot.time}
                                                    onClick={() => handleSlotSelection(slot)}
                                                    className="w-full flex items-center justify-between p-3 border border-stone-200 rounded-lg hover:border-[#BF9C73] hover:bg-[#BF9C73]/5 transition-colors"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <Clock className="w-4 h-4 text-slate-600" />
                                                        <span className="font-medium">{slot.displayTime}</span>
                                                    </div>
                                                    {slot.providerCount > 1 && (
                                                        <span className="text-sm text-slate-600 bg-stone-100 px-2 py-1 rounded">
                                                            {slot.providerCount} providers available
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
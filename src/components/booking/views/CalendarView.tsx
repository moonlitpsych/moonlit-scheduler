// src/components/booking/views/CalendarView.tsx
'use client'

import { Payer, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, startOfMonth, subMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Clock, Calendar, Users } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import ProviderCard, { Provider } from '@/components/shared/ProviderCard'
import { mapApiSlotToTimeSlot, devValidateApiData, validateApiResponse } from '@/lib/utils/dataValidation'

export type BookingIntent = 'book' | 'explore'

interface CalendarViewProps {
    selectedPayer?: Payer
    onTimeSlotSelected: (slot: TimeSlot) => void
    onBackToInsurance: () => void
    bookingMode?: 'normal' | 'from-effective-date'
    intent: BookingIntent
    selectedProvider?: { id: string, name: string } // NEW: for provider filtering
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

export default function CalendarView({ selectedPayer, onTimeSlotSelected, onBackToInsurance, bookingMode, intent, selectedProvider: propsSelectedProvider }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()) // Initialize with today
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedTimeSlot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>('')
    // Removed showInsuranceBanner state - redundant with subheader
    const [viewMode, setViewMode] = useState<'by_availability' | 'by_provider'>(propsSelectedProvider ? 'by_provider' : 'by_availability')
    const [providers, setProviders] = useState<any[]>([])
    const [selectedProvider, setSelectedProvider] = useState<string | null>(propsSelectedProvider?.id || null)
    const [loadingProviders, setLoadingProviders] = useState(false)
    
    // Language selection state
    const [selectedLanguage, setSelectedLanguage] = useState<string>('English')
    const [showLanguageOptions, setShowLanguageOptions] = useState(false)
    const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
    const [customLanguage, setCustomLanguage] = useState<string>('')
    const [loadingLanguages, setLoadingLanguages] = useState(false)

    // Ref for calendar section to enable smooth scrolling
    const calendarSectionRef = useRef<HTMLDivElement>(null)
    const [showCalendarHighlight, setShowCalendarHighlight] = useState(false)

    // Smooth scroll to calendar section with visual highlight
    const scrollToCalendar = () => {
        if (calendarSectionRef.current) {
            // For mobile devices, use 'center' to ensure the calendar is clearly visible
            const isMobile = window.innerWidth < 768
            calendarSectionRef.current.scrollIntoView({
                behavior: 'smooth',
                block: isMobile ? 'center' : 'start',
                inline: 'nearest'
            })
            
            // Add a subtle highlight animation to draw attention
            setShowCalendarHighlight(true)
            setTimeout(() => {
                setShowCalendarHighlight(false)
            }, 2000) // Remove highlight after 2 seconds
        }
    }

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

    // Auto-load today's availability when component mounts
    useEffect(() => {
        if (selectedPayer?.id && selectedDate) {
            console.log('🔄 Auto-loading availability for today...')
            fetchAvailabilityForDate(selectedDate)
        }
    }, [selectedPayer?.id]) // Re-run when payer changes

    // Load available languages when component mounts
    useEffect(() => {
        const loadLanguages = async () => {
            setLoadingLanguages(true)
            try {
                const response = await fetch('/api/patient-booking/available-languages')
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.languages) {
                        setAvailableLanguages(data.languages)
                    }
                }
            } catch (error) {
                console.error('Error loading languages:', error)
            } finally {
                setLoadingLanguages(false)
            }
        }
        loadLanguages()
    }, [])

    // Refetch providers and availability when language changes
    useEffect(() => {
        if (selectedPayer?.id && selectedDate && selectedLanguage !== 'English') {
            console.log('🌍 Language changed to:', selectedLanguage, '- refetching availability and providers')
            fetchAvailabilityForDate(selectedDate)
            if (viewMode === 'by_provider') {
                fetchProviders()
            }
        }
    }, [selectedLanguage])

    // Fetch providers for "Book by Practitioner" mode
    const fetchProviders = async () => {
        if (!selectedPayer?.id) return

        setLoadingProviders(true)
        try {
            const response = await fetch('/api/patient-booking/providers-for-payer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payer_id: selectedPayer.id,
                    language: selectedLanguage
                })
            })
            if (response.ok) {
                const data = await response.json()
                console.log('🔍 Provider API response:', data)
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

    // Find soonest available date for a provider
    const findSoonestAvailableDate = async (providerId: string): Promise<Date> => {
        const today = new Date()
        console.log('🔍 Finding soonest available date for provider:', providerId)
        
        // Try today first, then next 30 days
        for (let i = 0; i < 30; i++) {
            const testDate = new Date(today)
            testDate.setDate(today.getDate() + i)
            
            console.log('📅 Testing availability for:', format(testDate, 'yyyy-MM-dd'))
            
            try {
                const dateString = format(testDate, 'yyyy-MM-dd')
                const response = await fetch(`/api/patient-booking/merged-availability`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        payer_id: selectedPayer?.id,
                        date: dateString,
                        provider_id: providerId,
                        language: selectedLanguage
                    })
                })
                
                if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.data?.availableSlots && data.data.availableSlots.length > 0) {
                        console.log(`✅ Found availability on ${format(testDate, 'yyyy-MM-dd')} with ${data.data.availableSlots.length} slots`)
                        return testDate
                    }
                }
            } catch (error) {
                console.log('❌ Error checking date:', format(testDate, 'yyyy-MM-dd'), error)
            }
        }
        
        console.log('⚠️ No availability found in next 30 days, defaulting to today')
        return today
    }

    // Handle provider selection
    const handleProviderSelect = async (providerId: string) => {
        console.log('🔄 Provider selection starting:', { providerId, viewMode, currentSelectedProvider: selectedProvider })
        
        setSelectedProvider(providerId)
        setSelectedSlot(null)
        setConsolidatedSlots([])
        
        // Smooth scroll to calendar section to guide user to next step
        setTimeout(() => {
            scrollToCalendar()
        }, 100) // Small delay to ensure state updates have rendered
        
        if (selectedDate) {
            // If a date is already selected, refresh availability for this provider
            console.log('📅 Using existing selected date:', selectedDate, 'for provider:', providerId)
            await fetchAvailabilityForDate(selectedDate, providerId)
        } else {
            // Find and load soonest available date
            console.log('🔍 Finding soonest availability for provider:', providerId)
            const soonestDate = await findSoonestAvailableDate(providerId)
            console.log('📅 Setting soonest available date:', format(soonestDate, 'yyyy-MM-dd'), 'for provider:', providerId)
            setSelectedDate(soonestDate)
            await fetchAvailabilityForDate(soonestDate, providerId)
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
    // Filter out past time slots for same-day appointments
    const filterFutureTimeSlots = (slots: TimeSlot[], targetDate: Date): TimeSlot[] => {
        const today = new Date()
        const isToday = format(targetDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
        
        if (!isToday) {
            return slots // For future dates, return all slots
        }
        
        const now = new Date()
        return slots.filter(slot => {
            const slotDateTime = new Date(slot.start_time)
            return slotDateTime > now
        })
    }

    const consolidateTimeSlots = (slots: TimeSlot[]): ConsolidatedTimeSlot[] => {
        // First filter out past time slots if this is for today
        const filteredSlots = selectedDate ? filterFutureTimeSlots(slots, selectedDate) : slots
        
        const grouped = filteredSlots.reduce((acc, slot) => {
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
    const fetchAvailabilityForDate = async (date: Date, explicitProviderId?: string) => {
        // Allow a fallback payer ID for cash payments or fetch all providers when missing
        const payerId = selectedPayer?.id || 'cash-payment'
        const effectiveProviderId = explicitProviderId || selectedProvider
        
        console.log('🔍 fetchAvailabilityForDate called:', {
            date: format(date, 'yyyy-MM-dd'),
            explicitProviderId,
            selectedProvider,
            effectiveProviderId,
            bookingMode
        })

        if (!selectedPayer?.id) {
            console.warn('No payer selected, using cash-payment id to fetch all providers')
        }

        // For provider-specific mode, don't fetch availability until a provider is selected
        if (viewMode === 'by_provider' && !selectedProvider) {
            // In by_provider mode without a selected provider, don't fetch availability
            // The UI will show the provider selection interface instead
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
                mode: viewMode,
                willSendProviderIdToAPI: viewMode === 'by_provider' || selectedProvider ? selectedProvider : undefined
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
                        provider_id: viewMode === 'by_provider' || selectedProvider ? selectedProvider : undefined,
                        language: selectedLanguage
                    })
                })
                
                console.log('📊 Strategy 1 Response status:', response1.status)
                
                if (response1.ok) {
                    const data1 = await response1.json()
                    console.log('✅ Strategy 1 SUCCESS:', data1)
                    
                    // Validate API response structure
                    const responseValidation = validateApiResponse(data1, { success: true, data: {} })
                    if (!responseValidation.isValid) {
                        console.error('🚨 API Response validation failed:', responseValidation.errors)
                    }
                    
                    if (data1.success) {
                        const rawSlots = data1.data?.availableSlots || []
                        // Validate and normalize slot data in development
                        apiSlots = process.env.NODE_ENV === 'development' 
                            ? rawSlots.filter(slot => slot && typeof slot === 'object').map(mapApiSlotToTimeSlot)
                            : rawSlots
                        success = true
                        console.log(`📊 Processed ${apiSlots.length} slots with data validation`)
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
                            provider_id: viewMode === 'by_provider' && selectedProvider ? selectedProvider : undefined,
                            language: selectedLanguage
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

            // NO STRATEGY 3 - No fake data generation allowed
            // Only use real availability from the database

            if (!success) {
                console.error('❌ All API strategies failed - no availability data')
                setError('Unable to fetch availability. Please try again or contact support.')
                setAvailableSlots([])
                setConsolidatedSlots([])
                return
            }

            console.log('✅ FINAL SUCCESS: Got availability slots:', apiSlots.length)

            // Filter out empty or invalid slot objects before processing
            const validApiSlots = apiSlots.filter(slot => {
                if (!slot || typeof slot !== 'object') {
                    console.warn('🚨 Filtering out non-object slot:', slot)
                    return false
                }
                
                if (Object.keys(slot).length === 0) {
                    console.warn('🚨 Filtering out empty slot object:', slot)
                    return false
                }
                
                // Check for minimal required fields to ensure slot is processable
                if (!slot.provider_id && !slot.providerId && !slot.id) {
                    console.warn('🚨 Filtering out slot without provider ID:', slot)
                    return false
                }
                
                return true
            })

            console.log(`🔄 Filtered slots: ${apiSlots.length} → ${validApiSlots.length} valid slots`)

            // Convert AvailableSlot to TimeSlot format using data validation
            const convertedSlots: TimeSlot[] = validApiSlots
                .map(slot => {
                    try {
                        return mapApiSlotToTimeSlot(slot)
                    } catch (error) {
                        console.error('🚨 Failed to map slot, skipping:', slot, error)
                        return null
                    }
                })
                .filter(slot => slot !== null) as TimeSlot[]

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
    const handleSlotClick = async (consolidatedSlot: ConsolidatedTimeSlot) => {
        try {
            const firstSlot = consolidatedSlot.availableSlots[0]
            
            console.log('🔍 CalendarView handleSlotClick:', {
                firstSlot,
                viewMode,
                selectedProvider,
                firstSlotProviderId: firstSlot?.provider_id
            })
            
            // Calculate end time by adding duration to start time
            const startTime = selectedDate 
                ? `${format(selectedDate, 'yyyy-MM-dd')}T${consolidatedSlot.time}:00`
                : firstSlot.start_time
            
            const endTime = selectedDate 
                ? (() => {
                    const duration = firstSlot.duration_minutes || 60 // Default to 60 minutes
                    const startDate = new Date(startTime)
                    const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
                    return endDate.toISOString().slice(0, 19) // Remove Z and milliseconds
                  })()
                : firstSlot.end_time

            const properTimeSlot: TimeSlot = {
                ...firstSlot,
                start_time: startTime,
                end_time: endTime,
                // For provider mode, ensure we have the selected provider ID
                provider_id: viewMode === 'by_provider' && selectedProvider 
                    ? selectedProvider 
                    : firstSlot.provider_id
            }
            
            console.log('🔍 CalendarView properTimeSlot created:', {
                properTimeSlot,
                firstSlotProviderId: firstSlot.provider_id,
                finalProviderId: properTimeSlot.provider_id
            })
            
            setSelectedSlot(properTimeSlot)

            setConsolidatedSlots(prev =>
                prev.map(slot => ({
                    ...slot,
                    isSelected: slot.time === consolidatedSlot.time
                }))
            )

            // If user has entered a custom language, send email notification
            if (selectedLanguage === 'Other' && customLanguage.trim()) {
                try {
                    console.log('📧 Sending custom language request for:', customLanguage)
                    
                    const response = await fetch('/api/patient-booking/request-custom-language', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            customLanguage: customLanguage.trim(),
                            patientInfo: {
                                firstName: 'Patient', // We don't have patient info yet at this stage
                                lastName: '',
                                email: '',
                                phone: ''
                            },
                            selectedPayer: selectedPayer,
                            appointmentDetails: {
                                preferredDate: format(selectedDate || new Date(), 'yyyy-MM-dd'),
                                preferredTime: consolidatedSlot.displayTime,
                                notes: `Language request: ${customLanguage.trim()}`
                            }
                        })
                    })

                    if (response.ok) {
                        const data = await response.json()
                        console.log('✅ Custom language request sent successfully:', data.message)
                    } else {
                        console.error('⚠️ Failed to send custom language request')
                    }
                } catch (emailError) {
                    console.error('❌ Error sending custom language request:', emailError)
                }
            }
            
        } catch (error) {
            console.error('Error handling slot click:', error)
            setError('Error selecting time slot. Please try again.')
        }
    }

    const handleViewModeChange = async (mode: 'by_availability' | 'by_provider') => {
        setViewMode(mode)
        setSelectedProvider(null)
        setSelectedSlot(null)
        setConsolidatedSlots([])
        setAvailableSlots([])
        
        if (mode === 'by_provider') {
            // Fetch providers for this payer
            if (!selectedPayer?.id) return
            
            setLoadingProviders(true)
            try {
                const response = await fetch('/api/patient-booking/providers-for-payer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        payer_id: selectedPayer.id,
                        language: selectedLanguage
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    console.log('📋 Providers fetched for by_provider mode:', data)
                    console.log('📋 data.success:', data.success)
                    console.log('📋 data.data.providers:', data.data?.providers)
                    console.log('📋 data.data.providers type:', typeof data.data?.providers, 'length:', data.data?.providers?.length)
                    if (data.success && data.data?.providers) {
                        console.log('📋 Setting providers state with:', data.data.providers)
                        setProviders(data.data.providers)
                        console.log('📋 providers state should now be:', data.data.providers.length, 'items')
                    } else {
                        console.log('📋 NOT setting providers - success:', data.success, 'providers exists:', !!data.data?.providers)
                    }
                } else {
                    console.log('📋 Response not OK:', response.status, response.statusText)
                }
            } catch (error) {
                console.error('❌ Error fetching providers:', error)
            } finally {
                setLoadingProviders(false)
            }
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
                        {intent === 'explore' ? 'Available Appointment Times' : 'Select Your Appointment Time'}
                    </h1>
                    <p className="text-xl text-[#091747]/70 mb-6 font-['Newsreader']">
                        {viewMode === 'by_availability' 
                            ? `Showing merged availability for all providers who accept ${selectedPayer?.name}`
                            : selectedProvider
                                ? showCalendarHighlight 
                                    ? '👇 Select a date below to see this provider\'s available appointment times'
                                    : 'Select a date to see this provider\'s availability'
                                : 'Choose a provider to see their availability'
                        }
                    </p>
                </div>

                {/* Booking Mode Toggle */}
                <div className="max-w-lg mx-auto mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-2">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleViewModeChange('by_availability')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all font-['Newsreader'] ${
                                    viewMode === 'by_availability'
                                        ? 'bg-[#BF9C73] text-white shadow-sm'
                                        : 'text-[#091747]/70 hover:bg-stone-50'
                                }`}
                            >
                                <Calendar className="w-4 h-4" />
                                By Availability
                            </button>
                            <button
                                onClick={() => handleViewModeChange('by_provider')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all font-['Newsreader'] ${
                                    viewMode === 'by_provider'
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

                {/* Insurance Banner - REMOVED: Redundant with subheader */}

                {/* Provider Selection (Book by Practitioner mode) */}
                {viewMode === 'by_provider' && (
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
                                    {providers.filter(p => p.is_bookable !== false).slice(0, 4).map((provider) => (
                                        <ProviderCard
                                            key={provider.id}
                                            provider={provider as Provider}
                                            variant="selection"
                                            selected={selectedProvider === provider.id}
                                            onClick={() => handleProviderSelect(provider.id)}
                                            className="cursor-pointer"
                                        />
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
                <div 
                    ref={calendarSectionRef} 
                    className={`max-w-6xl mx-auto transition-all duration-1000 ${
                        showCalendarHighlight 
                            ? 'ring-4 ring-[#BF9C73]/30 ring-offset-4 ring-offset-[#FEF8F1] rounded-3xl' 
                            : ''
                    }`}
                >
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
                                            ${day && isToday(day) ? 'bg-[#2C5F6F] text-white font-medium' : ''}
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
                                            {consolidatedSlots.map((slot) => {
                                                // Check if any slots in this time are co-visit slots
                                                const hasCoVisit = slot.availableSlots.some((s: any) => s.isCoVisit)
                                                const coVisitSlot = slot.availableSlots.find((s: any) => s.isCoVisit)
                                                
                                                return (
                                                    <button
                                                        key={slot.time}
                                                        onClick={() => handleSlotClick(slot)}
                                                        className={`
                                                            py-4 px-4 rounded-xl text-sm font-medium transition-all duration-200 font-['Newsreader'] relative
                                                            hover:scale-105 hover:shadow-md
                                                            ${slot.isSelected
                                                                ? 'bg-[#BF9C73] text-white shadow-lg scale-105'
                                                                : 'bg-stone-100 hover:bg-stone-200 text-slate-700'
                                                            }
                                                            ${hasCoVisit ? 'border-2 border-orange-300' : ''}
                                                        `}
                                                    >
                                                        {/* Co-visit indicator */}
                                                        {hasCoVisit && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full" 
                                                                 title="Co-visit required (resident + attending)"></div>
                                                        )}
                                                        
                                                        <div>{slot.displayTime}</div>
                                                        <div className="text-xs opacity-80 mt-1">
                                                            {viewMode === 'by_provider' && selectedProvider
                                                                ? (() => {
                                                                    const provider = providers.find(p => p.id === selectedProvider);
                                                                    return provider ? `${provider.first_name} ${provider.last_name}` : 'Selected Provider';
                                                                })()
                                                                : hasCoVisit && coVisitSlot
                                                                    ? `Co-visit: ${(coVisitSlot as any).provider_name}`
                                                                    : (() => {
                                                                        const uniqueProviders = new Set(slot.availableSlots.map((s: any) => s.provider_id));
                                                                        const count = uniqueProviders.size;
                                                                        return `${count} provider${count !== 1 ? 's' : ''} available`;
                                                                    })()
                                                            }
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : !loading && !error ? (
                                        <div className="text-center py-8">
                                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                            <p className="text-slate-500 font-['Newsreader']">
                                                {viewMode === 'by_provider' && !selectedProvider 
                                                    ? "Select a provider to see availability."
                                                    : "No available time slots for this date.\nPlease try another day."
                                                }
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

                {/* Language Selection */}
                <div className="max-w-6xl mx-auto mb-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showLanguageOptions}
                            onChange={(e) => setShowLanguageOptions(e.target.checked)}
                            className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-2 focus:ring-[#BF9C73]"
                        />
                        <span className="text-[#091747] text-sm font-['Newsreader']">
                            My appointment should be held in a language other than English
                        </span>
                    </label>

                    {/* Language Options Dropdown */}
                    {showLanguageOptions && (
                        <div className="mt-4 ml-7 space-y-3 max-w-md">
                            <h4 className="font-medium text-[#091747] text-sm font-['Newsreader']">
                                What language should this appointment be held in?
                            </h4>
                            
                            {loadingLanguages ? (
                                <div className="text-sm text-gray-500 font-['Newsreader']">Loading languages...</div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Available Languages */}
                                    <select
                                        value={selectedLanguage === 'Other' ? 'Other' : selectedLanguage}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            if (value === 'Other') {
                                                setSelectedLanguage('Other')
                                            } else {
                                                setSelectedLanguage(value)
                                                setCustomLanguage('')
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] text-sm font-['Newsreader']"
                                    >
                                        {availableLanguages.map(language => (
                                            <option key={language} value={language}>
                                                {language}
                                            </option>
                                        ))}
                                        <option value="Other">Other (not listed here)</option>
                                    </select>

                                    {/* Custom Language Input */}
                                    {selectedLanguage === 'Other' && (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={customLanguage}
                                                onChange={(e) => setCustomLanguage(e.target.value)}
                                                placeholder="Please specify the language"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-[#BF9C73] text-sm font-['Newsreader']"
                                            />
                                            {customLanguage && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                    <div className="flex items-start space-x-2">
                                                        <div className="w-4 h-4 bg-yellow-400 rounded-full mt-0.5 flex-shrink-0"></div>
                                                        <div className="text-sm">
                                                            <p className="font-medium text-yellow-800 mb-1 font-['Newsreader']">
                                                                Pending Review
                                                            </p>
                                                            <p className="text-yellow-700 font-['Newsreader']">
                                                                Your request for an appointment in <strong>{customLanguage}</strong> will be reviewed manually. 
                                                                We'll contact you to arrange this appointment.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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
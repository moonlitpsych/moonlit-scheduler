'use client'

import { Payer, TimeSlot } from '@/types/database'
import { useEffect, useState } from 'react'

type CalendarViewMode = 'merged' | 'individual'

interface CalendarViewProps {
    selectedPayer: Payer
    selectedProviderId?: string // NEW: For individual provider view
    calendarViewMode: CalendarViewMode // NEW: Current view mode
    onTimeSlotSelected: (timeSlot: TimeSlot) => void
    onViewModeChange: (mode: CalendarViewMode) => void // NEW: Toggle between modes
    onBackToInsurance: () => void
    onChangeProvider?: () => void // NEW: Easy provider change
}

interface AvailabilityData {
    success: boolean
    availability: TimeSlot[]
    provider_name?: string
    error?: string
}

export default function CalendarView({
    selectedPayer,
    selectedProviderId,
    calendarViewMode,
    onTimeSlotSelected,
    onViewModeChange,
    onBackToInsurance,
    onChangeProvider
}: CalendarViewProps) {
    const [availability, setAvailability] = useState<TimeSlot[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [providerName, setProviderName] = useState<string>('')

    useEffect(() => {
        fetchAvailability()
    }, [selectedPayer.id, selectedProviderId, calendarViewMode])

    const fetchAvailability = async () => {
        try {
            setLoading(true)
            setError(null)

            let url: string
            
            if (calendarViewMode === 'individual' && selectedProviderId) {
                // Individual provider view
                url = `/api/patient-booking/provider-availability?provider_id=${selectedProviderId}&payer_id=${selectedPayer.id}`
            } else {
                // Merged availability view
                url = `/api/patient-booking/merged-availability?payer_id=${selectedPayer.id}`
            }

            const response = await fetch(url)
            
            if (!response.ok) {
                throw new Error('Failed to fetch availability')
            }

            const data: AvailabilityData = await response.json()
            
            if (data.success) {
                setAvailability(data.availability)
                setProviderName(data.provider_name || '')
                
                // Auto-select first available date
                if (data.availability.length > 0) {
                    const firstDate = data.availability[0].date
                    setSelectedDate(firstDate)
                }
            } else {
                throw new Error(data.error || 'Failed to load availability')
            }
        } catch (err) {
            console.error('Error fetching availability:', err)
            setError(err instanceof Error ? err.message : 'Failed to load availability')
        } finally {
            setLoading(false)
        }
    }

    // Group time slots by date
    const groupedAvailability = availability.reduce((acc, slot) => {
        if (!acc[slot.date]) {
            acc[slot.date] = []
        }
        acc[slot.date].push(slot)
        return acc
    }, {} as Record<string, TimeSlot[]>)

    const availableDates = Object.keys(groupedAvailability).sort()
    const selectedDateSlots = selectedDate ? groupedAvailability[selectedDate] || [] : []

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const formatTime = (timeString: string) => {
        const [hours, minutes] = timeString.split(':')
        const date = new Date()
        date.setHours(parseInt(hours), parseInt(minutes))
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c] flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Loading availability...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c] flex items-center justify-center">
                <div className="text-white text-center">
                    <p className="mb-4">{error}</p>
                    <button
                        type="button"
                        onClick={onBackToInsurance}
                        className="px-6 py-3 bg-white text-[#1a2c5b] rounded-xl font-medium hover:bg-gray-100 transition-colors"
                    >
                        Back to Insurance Selection
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2c5b] to-[#2d4a7c]">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-white text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">
                        {calendarViewMode === 'individual' && providerName 
                            ? `Book with ${providerName}` 
                            : 'Choose Your Appointment Time'}
                    </h1>
                    <p className="text-xl opacity-90 mb-6">
                        {calendarViewMode === 'individual' 
                            ? `Individual calendar for ${providerName}` 
                            : `All available appointments with providers who accept ${selectedPayer.name}`}
                    </p>

                    {/* View Mode Controls */}
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <div className="flex bg-white/20 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => onViewModeChange('merged')}
                                className={`px-6 py-2 transition-colors ${
                                    calendarViewMode === 'merged'
                                        ? 'bg-white text-[#1a2c5b]'
                                        : 'text-white hover:bg-white/10'
                                }`}
                            >
                                All Providers
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewModeChange('individual')}
                                className={`px-6 py-2 transition-colors ${
                                    calendarViewMode === 'individual'
                                        ? 'bg-white text-[#1a2c5b]'
                                        : 'text-white hover:bg-white/10'
                                }`}
                            >
                                Choose Provider
                            </button>
                        </div>

                        {/* Change Provider Button (only in individual mode) */}
                        {calendarViewMode === 'individual' && onChangeProvider && (
                            <button
                                type="button"
                                onClick={onChangeProvider}
                                className="px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
                            >
                                Change Provider
                            </button>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center justify-center gap-4 text-sm">
                        <button
                            type="button"
                            onClick={onBackToInsurance}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            ← Change Insurance
                        </button>
                    </div>
                </div>

                {/* Calendar Content */}
                {availability.length === 0 ? (
                    <div className="text-white text-center">
                        <p className="text-xl mb-4">
                            {calendarViewMode === 'individual' && providerName
                                ? `${providerName} has no available appointments at this time.`
                                : `No appointments available with ${selectedPayer.name} at this time.`}
                        </p>
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={onBackToInsurance}
                                className="block mx-auto px-6 py-3 bg-white text-[#1a2c5b] rounded-xl font-medium hover:bg-gray-100 transition-colors"
                            >
                                Try Different Insurance
                            </button>
                            {calendarViewMode === 'individual' && (
                                <button
                                    type="button"
                                    onClick={() => onViewModeChange('merged')}
                                    className="block mx-auto px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
                                >
                                    View All Providers
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Date Selection */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-2xl p-6 shadow-lg">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">Available Dates</h3>
                                    <div className="space-y-2">
                                        {availableDates.map((date) => (
                                            <button
                                                key={date}
                                                type="button"
                                                onClick={() => setSelectedDate(date)}
                                                className={`w-full text-left p-3 rounded-xl transition-colors ${
                                                    selectedDate === date
                                                        ? 'bg-[#BF9C73] text-white'
                                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                                                }`}
                                            >
                                                <div className="font-medium">
                                                    {formatDate(date)}
                                                </div>
                                                <div className="text-sm opacity-80">
                                                    {groupedAvailability[date].length} slot{groupedAvailability[date].length !== 1 ? 's' : ''} available
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Time Selection */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-2xl p-6 shadow-lg">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                                        {selectedDate ? formatDate(selectedDate) : 'Select a date'}
                                    </h3>
                                    
                                    {selectedDate && selectedDateSlots.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {selectedDateSlots.map((slot) => (
                                                <button
                                                    key={`${slot.date}-${slot.start_time}`}
                                                    type="button"
                                                    onClick={() => onTimeSlotSelected(slot)}
                                                    className="p-4 border border-gray-200 rounded-xl hover:border-[#BF9C73] hover:bg-[#BF9C73]/5 transition-colors group"
                                                >
                                                    <div className="font-medium text-gray-900 group-hover:text-[#BF9C73]">
                                                        {formatTime(slot.start_time)}
                                                    </div>
                                                    {calendarViewMode === 'merged' && slot.provider_name && (
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            with {slot.provider_name}
                                                        </div>
                                                    )}
                                                    {slot.duration_minutes && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {slot.duration_minutes} minutes
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : selectedDate ? (
                                        <p className="text-gray-600">No time slots available for this date.</p>
                                    ) : (
                                        <p className="text-gray-600">Select a date to view available times.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
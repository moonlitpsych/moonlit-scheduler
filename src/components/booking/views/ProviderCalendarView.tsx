// src/components/booking/views/ProviderCalendarView.tsx
'use client'

import { Payer, TimeSlot } from '@/types/database'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isToday, startOfMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import type { Provider } from './ProviderSelectionView'

interface ProviderCalendarViewProps {
    selectedPayer: Payer
    selectedProvider: Provider
    onTimeSlotSelected: (slot: TimeSlot) => void
    onBackToProviders: () => void
    onBackToMerged: () => void
}

interface AvailableSlot {
    date: string
    time: string
    duration: number
    provider_id: string
    available: boolean
    provider_name?: string
}

export default function ProviderCalendarView({ selectedPayer, selectedProvider, onTimeSlotSelected, onBackToProviders, onBackToMerged }: ProviderCalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>('')

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startPadding = getDay(monthStart)
    const paddedDays = [
        ...Array(startPadding).fill(null),
        ...days
    ]

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

    const fetchAvailabilityForDate = async (date: Date) => {
        const payerId = selectedPayer?.id || 'cash-payment'
        const dateString = format(date, 'yyyy-MM-dd')
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`/api/patient-booking/provider-availability?payer_id=${payerId}&provider_id=${selectedProvider.id}&date=${dateString}`)
            if (!response.ok) {
                throw new Error('Failed to fetch availability')
            }
            const data = await response.json()
            const apiSlots: AvailableSlot[] = data.data?.availableSlots || []
            const converted: TimeSlot[] = apiSlots.map(slot => {
                const startTime = `${slot.date}T${slot.time}:00`
                return {
                    start_time: startTime,
                    end_time: new Date(new Date(startTime).getTime() + slot.duration * 60000).toISOString(),
                    duration_minutes: slot.duration,
                    date: slot.date,
                    provider_id: slot.provider_id,
                    provider_name: slot.provider_name
                }
            })
            setAvailableSlots(converted)
        } catch (err) {
            console.error('Error fetching availability:', err)
            setError('Failed to load availability')
        } finally {
            setLoading(false)
        }
    }

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)
        setSelectedSlot(null)
        fetchAvailabilityForDate(date)
    }

    const formatTimeDisplay = (slot: TimeSlot): string => {
        const start = new Date(slot.start_time)
        const hours = start.getHours()
        const minutes = start.getMinutes()
        const period = hours >= 12 ? 'pm' : 'am'
        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    const handleNext = () => {
        if (selectedSlot) {
            onTimeSlotSelected(selectedSlot)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] to-[#F6B398]/20">
            <div className="container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-[#091747] mb-4 font-['Newsreader']">
                        Select a time with {selectedProvider.first_name} {selectedProvider.last_name}
                    </h1>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={onBackToProviders}
                            className="px-6 py-2 bg-white text-[#091747] rounded-xl border border-[#BF9C73] hover:bg-[#FEF8F1] transition-colors font-['Newsreader']"
                        >
                            ← Choose Provider
                        </button>
                        <span className="text-[#091747]/60">|</span>
                        <button
                            type="button"
                            onClick={onBackToMerged}
                            className="px-6 py-2 bg-white text-[#091747] rounded-xl border border-[#BF9C73] hover:bg-[#FEF8F1] transition-colors font-['Newsreader']"
                        >
                            View Merged Calendar
                        </button>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {dayLabels.map((day, index) => (
                                    <div key={index} className="text-center text-sm text-slate-500 py-2 font-['Newsreader']">
                                        {day}
                                    </div>
                                ))}
                            </div>

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
                                            ${day && !isToday(day) && (!selectedDate || !isSameDay(day, selectedDate)) && day >= new Date().setHours(0,0,0,0) ? 'hover:bg-stone-100 text-slate-700' : ''}
                                        `}
                                    >
                                        {day?.getDate()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-['Newsreader']">
                                        Loading availability...
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-8">
                                    <p className="text-red-600 mb-4 font-['Newsreader']">{error}</p>
                                </div>
                            ) : availableSlots.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {availableSlots.map((slot, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`p-4 rounded-xl border transition-all duration-200 font-['Newsreader'] ${
                                                selectedSlot?.start_time === slot.start_time
                                                    ? 'bg-[#BF9C73] text-white border-[#BF9C73]'
                                                    : 'bg-white text-slate-700 border-stone-200 hover:bg-stone-50'
                                            }`}
                                        >
                                            {formatTimeDisplay(slot)}
                                        </button>
                                    ))}
                                </div>
                            ) : selectedDate ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 font-['Newsreader']">
                                        No availability on this date.
                                    </p>
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

                <div className="flex items-center justify-between max-w-6xl mx-auto mt-8">
                    <button
                        onClick={onBackToProviders}
                        className="py-3 px-6 rounded-xl font-medium transition-colors bg-stone-200 hover:bg-stone-300 text-slate-700 font-['Newsreader']"
                    >
                        ← Back to Providers
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!selectedSlot}
                        className={`
                            py-3 px-6 rounded-xl font-medium transition-all duration-200 font-['Newsreader']
                            ${selectedSlot ? 'bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white shadow-lg hover:shadow-xl' : 'bg-stone-300 text-stone-500 cursor-not-allowed'}
                        `}
                    >
                        Continue to Patient Info →
                    </button>
                </div>
            </div>
        </div>
    )
}

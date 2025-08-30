'use client'

import { AlertCircle, AlertTriangle, Calendar, Clock, Plus, Repeat, X } from 'lucide-react'
import { useState } from 'react'

interface AvailabilityBlock {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    is_recurring: boolean
}

interface AvailabilityException {
    id?: string
    provider_id: string
    exception_date: string
    end_date?: string
    exception_type: 'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'
    start_time?: string
    end_time?: string
    is_recurring?: boolean
    note?: string
}

interface MonthlyCalendarViewProps {
    schedule: AvailabilityBlock[]
    exceptions: AvailabilityException[]
    onAddException: () => void
}

export default function MonthlyCalendarView({ schedule, exceptions, onAddException }: MonthlyCalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    
    // Get first day of current month and number of days
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday
    
    const monthName = currentDate.toLocaleString('default', { month: 'long' })
    const year = currentDate.getFullYear()
    
    // Generate calendar grid
    const calendarDays = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarDays.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day)
    }
    
    // Helper function to check if a day has regular availability
    const hasRegularAvailability = (dayOfWeek: number) => {
        return schedule.some(block => block.day_of_week === dayOfWeek)
    }
    
    // Helper function to get exceptions for a specific date
    const getExceptionsForDate = (day: number) => {
        const dateString = `${year}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        return exceptions.filter(exception => {
            const exceptionDate = new Date(exception.exception_date).toISOString().split('T')[0]
            return exceptionDate === dateString
        })
    }
    
    // Helper function to get exception type color
    const getExceptionColor = (type: string) => {
        switch (type) {
            case 'vacation':
                return 'bg-orange-200 text-orange-800 border-orange-300'
            case 'unavailable':
                return 'bg-red-200 text-red-800 border-red-300'
            case 'custom_hours':
                return 'bg-blue-200 text-blue-800 border-blue-300'
            case 'partial_block':
                return 'bg-yellow-200 text-yellow-800 border-yellow-300'
            case 'recurring_change':
                return 'bg-purple-200 text-purple-800 border-purple-300'
            default:
                return 'bg-gray-200 text-gray-800 border-gray-300'
        }
    }
    
    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev)
            if (direction === 'prev') {
                newDate.setMonth(newDate.getMonth() - 1)
            } else {
                newDate.setMonth(newDate.getMonth() + 1)
            }
            return newDate
        })
    }
    
    const goToToday = () => {
        setCurrentDate(new Date())
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-[#091747]">Monthly Calendar</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigateMonth('prev')}
                            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <span className="text-[#091747]">‹</span>
                        </button>
                        <h3 className="text-lg font-semibold text-[#091747] min-w-[200px] text-center">
                            {monthName} {year}
                        </h3>
                        <button
                            onClick={() => navigateMonth('next')}
                            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <span className="text-[#091747]">›</span>
                        </button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={goToToday}
                        className="bg-stone-100 hover:bg-stone-200 text-[#091747] px-4 py-2 rounded-lg transition-colors font-medium"
                    >
                        Today
                    </button>
                    <button
                        onClick={onAddException}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Exception
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3 text-center font-semibold text-[#091747] bg-stone-50 rounded-lg">
                        {day}
                    </div>
                ))}
                
                {/* Calendar days */}
                {calendarDays.map((day, index) => {
                    if (day === null) {
                        return <div key={`empty-${index}`} className="p-2 h-24"></div>
                    }
                    
                    const dayOfWeek = (index) % 7
                    const hasAvailability = hasRegularAvailability(dayOfWeek)
                    const dayExceptions = getExceptionsForDate(day)
                    const isToday = new Date().toDateString() === new Date(year, currentDate.getMonth(), day).toDateString()
                    
                    return (
                        <div
                            key={`day-${day}`}
                            className={`p-2 h-24 border rounded-lg transition-colors ${
                                isToday 
                                    ? 'border-[#BF9C73] bg-[#FEF8F1]' 
                                    : hasAvailability 
                                        ? 'border-stone-200 bg-green-50' 
                                        : 'border-stone-200 bg-stone-50'
                            }`}
                        >
                            {/* Day number */}
                            <div className={`text-sm font-medium mb-1 ${
                                isToday ? 'text-[#BF9C73]' : 'text-[#091747]'
                            }`}>
                                {day}
                            </div>
                            
                            {/* Regular availability indicator */}
                            {hasAvailability && dayExceptions.length === 0 && (
                                <div className="w-full h-1 bg-[#17DB4E] rounded mb-1"></div>
                            )}
                            
                            {/* Exception blocks */}
                            {dayExceptions.map((exception, idx) => (
                                <div
                                    key={`exception-${exception.id || idx}-${day}`}
                                    className={`text-xs px-2 py-1 rounded mb-1 border ${getExceptionColor(exception.exception_type)}`}
                                    title={`${exception.exception_type}: ${exception.note || ''}`}
                                >
                                    <div className="flex items-center gap-1">
                                        {exception.exception_type === 'vacation' && <Calendar className="h-3 w-3" />}
                                        {exception.exception_type === 'unavailable' && <X className="h-3 w-3" />}
                                        {exception.exception_type === 'custom_hours' && <Clock className="h-3 w-3" />}
                                        {exception.exception_type === 'partial_block' && <AlertTriangle className="h-3 w-3" />}
                                        {exception.exception_type === 'recurring_change' && <Repeat className="h-3 w-3" />}
                                        <span className="truncate">
                                            {exception.exception_type === 'vacation' ? 'Vacation' : 
                                             exception.exception_type === 'unavailable' ? 'Out' :
                                             exception.exception_type === 'custom_hours' ? 'Custom' :
                                             exception.exception_type === 'partial_block' ? 'Blocked' :
                                             'Change'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                })}
            </div>
            
            {/* Legend */}
            <div className="mt-6 pt-6 border-t border-stone-200">
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-50 border border-stone-200 rounded"></div>
                        <span className="text-[#091747]">Regular availability</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
                        <span className="text-[#091747]">Vacation</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-200 border border-red-300 rounded"></div>
                        <span className="text-[#091747]">Unavailable</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-200 border border-blue-300 rounded"></div>
                        <span className="text-[#091747]">Custom hours</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-200 border border-yellow-300 rounded"></div>
                        <span className="text-[#091747]">Partial block</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
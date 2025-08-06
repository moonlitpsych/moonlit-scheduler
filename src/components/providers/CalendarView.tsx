'use client'

import { AvailabilityException, WeeklySchedule } from '@/services/providerAvailabilityService'
import { Calendar, Clock } from 'lucide-react'
import { useMemo } from 'react'

interface CalendarViewProps {
  schedule: WeeklySchedule
  exceptions: AvailabilityException[]
  weekStartDate?: Date
}

export default function CalendarView({ 
  schedule, 
  exceptions,
  weekStartDate = new Date()
}: CalendarViewProps) {
  // Generate time slots from 6 AM to 10 PM in 30-minute increments
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      if (hour < 22) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`)
      }
    }
    return slots
  }, [])

  // Days of the week
  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' }
  ]

  // Calculate the week dates
  const getWeekDates = () => {
    const dates = []
    const startOfWeek = new Date(weekStartDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(diff + i)
      dates.push(date)
    }
    return dates
  }

  const weekDates = getWeekDates()

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}${minutes === '00' ? '' : ':' + minutes} ${ampm}`
  }

  // Check if a time slot is within availability
  const isTimeAvailable = (day: string, time: string) => {
    const daySchedule = schedule[day as keyof WeeklySchedule]
    if (!daySchedule || !daySchedule.is_available) return false

    const blocks = daySchedule.availability_blocks || []
    const timeMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])

    return blocks.some(block => {
      const startMinutes = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1])
      const endMinutes = parseInt(block.end_time.split(':')[0]) * 60 + parseInt(block.end_time.split(':')[1])
      return timeMinutes >= startMinutes && timeMinutes < endMinutes
    })
  }

  // Check if a date has an exception
  const getExceptionForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return exceptions.find(e => e.exception_date === dateStr)
  }

  // Get availability block that contains this time
  const getAvailabilityBlock = (day: string, time: string) => {
    const daySchedule = schedule[day as keyof WeeklySchedule]
    if (!daySchedule || !daySchedule.is_available) return null

    const blocks = daySchedule.availability_blocks || []
    const timeMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1])

    return blocks.find(block => {
      const startMinutes = parseInt(block.start_time.split(':')[0]) * 60 + parseInt(block.start_time.split(':')[1])
      return timeMinutes === startMinutes
    })
  }

  // Calculate block height based on duration
  const getBlockHeight = (startTime: string, endTime: string) => {
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])
    const duration = endMinutes - startMinutes
    return (duration / 30) * 40 // 40px per 30-minute slot
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="bg-[#091747] text-white p-4 flex items-center gap-3">
        <Calendar className="w-5 h-5" />
        <h3 className="font-semibold">Weekly Schedule View</h3>
        <span className="text-sm opacity-80 ml-auto">
          Week of {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-stone-200">
            <div className="p-3 bg-stone-50 border-r border-stone-200">
              <Clock className="w-4 h-4 text-stone-400 mx-auto" />
            </div>
            {daysOfWeek.map((day, index) => {
              const date = weekDates[index]
              const exception = getExceptionForDate(date)
              
              return (
                <div key={day.key} className="p-3 bg-stone-50 border-r border-stone-200 text-center">
                  <div className="font-medium text-[#091747] text-sm">{day.short}</div>
                  <div className="text-xs text-stone-500">
                    {date.getDate()}
                  </div>
                  {exception && (
                    <div className={`mt-1 px-2 py-0.5 text-xs rounded-full ${
                      exception.exception_type === 'unavailable' 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {exception.exception_type === 'unavailable' ? 'Off' : 'Modified'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Time Slots */}
          <div className="relative">
            {timeSlots.map((time, timeIndex) => (
              <div key={time} className="grid grid-cols-8 border-b border-stone-100 h-10 relative">
                {/* Time Label */}
                <div className="p-2 text-xs text-stone-500 border-r border-stone-200 bg-stone-50">
                  {timeIndex % 2 === 0 && formatTime(time)}
                </div>
                
                {/* Day Cells */}
                {daysOfWeek.map((day) => {
                  const block = getAvailabilityBlock(day.key, time)
                  const isAvailable = isTimeAvailable(day.key, time)
                  const date = weekDates[daysOfWeek.findIndex(d => d.key === day.key)]
                  const exception = getExceptionForDate(date)
                  
                  return (
                    <div
                      key={`${day.key}-${time}`}
                      className={`border-r border-stone-100 relative ${
                        exception?.exception_type === 'unavailable'
                          ? 'bg-red-50 opacity-50'
                          : isAvailable
                          ? 'bg-[#BF9C73]/10'
                          : ''
                      }`}
                    >
                      {/* Render availability block */}
                      {block && (
                        <div
                          className="absolute left-1 right-1 bg-[#BF9C73] text-white rounded px-2 py-1 text-xs z-10 shadow-sm"
                          style={{
                            height: `${getBlockHeight(block.start_time, block.end_time) - 4}px`,
                            top: '2px'
                          }}
                        >
                          <div className="font-medium truncate">Available</div>
                          <div className="text-[10px] opacity-90">
                            {formatTime(block.start_time)} - {formatTime(block.end_time)}
                          </div>
                        </div>
                      )}
                      
                      {/* Custom hours exception */}
                      {exception?.exception_type === 'custom_hours' && 
                       exception.start_time && exception.end_time &&
                       time === exception.start_time && (
                        <div
                          className="absolute left-1 right-1 bg-orange-500 text-white rounded px-2 py-1 text-xs z-10 shadow-sm"
                          style={{
                            height: `${getBlockHeight(exception.start_time, exception.end_time) - 4}px`,
                            top: '2px'
                          }}
                        >
                          <div className="font-medium truncate">Custom Hours</div>
                          <div className="text-[10px] opacity-90">
                            {formatTime(exception.start_time)} - {formatTime(exception.end_time)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-stone-50 border-t border-stone-200">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#BF9C73] rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Custom Hours</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Unavailable</span>
          </div>
        </div>
      </div>
    </div>
  )
}
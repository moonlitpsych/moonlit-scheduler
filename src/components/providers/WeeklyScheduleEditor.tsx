'use client'

import { Copy, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface TimeSlot {
  id?: string
  start_time: string
  end_time: string
}

interface DaySchedule {
  day_of_week: number
  day_name: string
  slots: TimeSlot[]
  is_available: boolean
}

interface WeeklyScheduleEditorProps {
  providerId: string
  initialSchedule?: DaySchedule[]
  onSave?: (schedule: DaySchedule[]) => Promise<void>
}

const DAYS = [
  { value: 0, name: 'Sunday', short: 'Sun' },
  { value: 1, name: 'Monday', short: 'Mon' },
  { value: 2, name: 'Tuesday', short: 'Tue' },
  { value: 3, name: 'Wednesday', short: 'Wed' },
  { value: 4, name: 'Thursday', short: 'Thu' },
  { value: 5, name: 'Friday', short: 'Fri' },
  { value: 6, name: 'Saturday', short: 'Sat' },
]

export default function WeeklyScheduleEditor({ 
  providerId, 
  initialSchedule,
  onSave 
}: WeeklyScheduleEditorProps) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    initialSchedule || DAYS.map(day => ({
      day_of_week: day.value,
      day_name: day.name,
      slots: [],
      is_available: false
    }))
  )
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Add new time slot to a day
  const addTimeSlot = (dayIndex: number) => {
    setSchedule(prev => prev.map((day, idx) => 
      idx === dayIndex ? {
        ...day,
        slots: [...day.slots, { start_time: '09:00', end_time: '17:00' }],
        is_available: true
      } : day
    ))
  }

  // Remove time slot from a day
  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    setSchedule(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day
      
      const newSlots = day.slots.filter((_, sIdx) => sIdx !== slotIndex)
      return {
        ...day,
        slots: newSlots,
        is_available: newSlots.length > 0
      }
    }))
  }

  // Update time slot
  const updateTimeSlot = (
    dayIndex: number, 
    slotIndex: number, 
    field: 'start_time' | 'end_time', 
    value: string
  ) => {
    setSchedule(prev => prev.map((day, idx) => 
      idx === dayIndex ? {
        ...day,
        slots: day.slots.map((slot, sIdx) => 
          sIdx === slotIndex ? { ...slot, [field]: value } : slot
        )
      } : day
    ))
  }

  // Toggle day availability
  const toggleDayAvailability = (dayIndex: number) => {
    setSchedule(prev => prev.map((day, idx) => 
      idx === dayIndex ? {
        ...day,
        is_available: !day.is_available,
        slots: !day.is_available ? day.slots : []
      } : day
    ))
  }

  // Copy schedule from one day to another
  const copyDaySchedule = (fromDayIndex: number, toDayIndex: number) => {
    const sourceDay = schedule[fromDayIndex]
    setSchedule(prev => prev.map((day, idx) => 
      idx === toDayIndex ? {
        ...day,
        slots: [...sourceDay.slots],
        is_available: sourceDay.is_available
      } : day
    ))
  }

  // Save schedule
  const handleSave = async () => {
    setLoading(true)
    setSuccess(false)

    try {
      if (onSave) {
        await onSave(schedule)
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
            Weekly Schedule
          </h3>
          <p className="text-sm text-[#091747]/70">
            Set your recurring weekly availability for patient bookings
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {success && (
            <span className="text-sm text-green-600 font-medium">
              ✅ Schedule saved!
            </span>
          )}
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-[#BF9C73] hover:bg-[#A88861] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {schedule.map((day, dayIndex) => (
          <div key={day.day_of_week} className="bg-white rounded-lg border border-stone-200 p-4">
            {/* Day Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.is_available}
                    onChange={() => toggleDayAvailability(dayIndex)}
                    className="w-4 h-4 text-[#BF9C73] rounded focus:ring-[#BF9C73]"
                  />
                  <span className="font-medium text-[#091747]">
                    {day.day_name}
                  </span>
                </label>
              </div>

              {day.is_available && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addTimeSlot(dayIndex)}
                    className="flex items-center gap-1 text-[#BF9C73] hover:text-[#A88861] text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Time
                  </button>
                </div>
              )}
            </div>

            {/* Time Slots */}
            {day.is_available && (
              <div className="space-y-3">
                {day.slots.length === 0 && (
                  <p className="text-sm text-[#091747]/50 text-center py-4 border-2 border-dashed border-stone-200 rounded-lg">
                    Click "Add Time" to set your availability for {day.day_name}
                  </p>
                )}

                {day.slots.map((slot, slotIndex) => (
                  <div key={`${dayIndex}-${slotIndex}`} className="flex items-center gap-3">
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'start_time', e.target.value)}
                      className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                    />
                    
                    <span className="text-[#091747]/70">to</span>
                    
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'end_time', e.target.value)}
                      className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                    />

                    <button
                      onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove time slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Copy Controls */}
                {day.slots.length > 0 && (
                  <div className="pt-2 border-t border-stone-200">
                    <div className="flex items-center gap-2">
                      <Copy className="w-4 h-4 text-[#091747]/50" />
                      <span className="text-sm text-[#091747]/70">Copy to:</span>
                      {DAYS.filter(d => d.value !== day.day_of_week).map(targetDay => (
                        <button
                          key={targetDay.value}
                          onClick={() => copyDaySchedule(dayIndex, DAYS.findIndex(d => d.value === targetDay.value))}
                          className="px-2 py-1 text-xs bg-[#BF9C73]/10 text-[#BF9C73] rounded hover:bg-[#BF9C73]/20 transition-colors"
                        >
                          {targetDay.short}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Unavailable Message */}
            {!day.is_available && (
              <p className="text-sm text-[#091747]/50 text-center py-8 bg-stone-50 rounded-lg">
                Not available on {day.day_name}s
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Templates */}
      <div className="bg-[#F6B398]/10 border border-[#BF9C73]/30 rounded-lg p-4">
        <h4 className="font-medium text-[#091747] mb-3">Quick Templates</h4>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              // Apply standard business hours template
              setSchedule(prev => prev.map(day => 
                day.day_of_week >= 1 && day.day_of_week <= 5 ? {
                  ...day,
                  is_available: true,
                  slots: [{ start_time: '09:00', end_time: '17:00' }]
                } : day
              ))
            }}
            className="px-3 py-2 bg-white border border-[#BF9C73] text-[#BF9C73] text-sm rounded-lg hover:bg-[#BF9C73] hover:text-white transition-colors"
          >
            Standard Business (M-F 9-5)
          </button>
          
          <button
            onClick={() => {
              // Apply morning hours template  
              setSchedule(prev => prev.map(day => 
                day.day_of_week >= 1 && day.day_of_week <= 5 ? {
                  ...day,
                  is_available: true,
                  slots: [{ start_time: '08:00', end_time: '12:00' }]
                } : day
              ))
            }}
            className="px-3 py-2 bg-white border border-[#BF9C73] text-[#BF9C73] text-sm rounded-lg hover:bg-[#BF9C73] hover:text-white transition-colors"
          >
            Morning Hours (M-F 8-12)
          </button>
          
          <button
            onClick={() => {
              // Clear all schedules
              setSchedule(prev => prev.map(day => ({
                ...day,
                is_available: false,
                slots: []
              })))
            }}
            className="px-3 py-2 bg-white border border-stone-300 text-[#091747]/70 text-sm rounded-lg hover:bg-stone-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}
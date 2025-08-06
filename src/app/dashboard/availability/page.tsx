/ src/components/dashboard/AvailabilityManager.tsx
'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
    Calendar,
    Clock,
    Plus,
    Save,
    Trash2,
    X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Availability = Database['public']['Tables']['provider_availability']['Row']
type Exception = Database['public']['Tables']['provider_availability_exceptions']['Row']

interface AvailabilityManagerProps {
  providerId: string
  availability: Availability[]
  exceptions: Exception[]
}

interface TimeSlot {
  id?: string
  start_time: string
  end_time: string
}

interface DaySchedule {
  day_of_week: number
  slots: TimeSlot[]
}

const DAYS = [
  { name: 'Sunday', value: 0 },
  { name: 'Monday', value: 1 },
  { name: 'Tuesday', value: 2 },
  { name: 'Wednesday', value: 3 },
  { name: 'Thursday', value: 4 },
  { name: 'Friday', value: 5 },
  { name: 'Saturday', value: 6 },
]

export default function AvailabilityManager({ 
  providerId, 
  availability, 
  exceptions 
}: AvailabilityManagerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'weekly' | 'exceptions'>('weekly')
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  // Convert availability to day schedules
  const [schedules, setSchedules] = useState<DaySchedule[]>(() => {
    const scheduleMap = new Map<number, TimeSlot[]>()
    
    availability.forEach(avail => {
      if (!scheduleMap.has(avail.day_of_week)) {
        scheduleMap.set(avail.day_of_week, [])
      }
      scheduleMap.get(avail.day_of_week)!.push({
        id: avail.id,
        start_time: avail.start_time,
        end_time: avail.end_time,
      })
    })

    return DAYS.map(day => ({
      day_of_week: day.value,
      slots: scheduleMap.get(day.value) || []
    }))
  })

  // Exception management
  const [newException, setNewException] = useState({
    exception_date: '',
    exception_type: 'unavailable' as const,
    start_time: '',
    end_time: '',
    reason: ''
  })

  const addTimeSlot = (dayIndex: number) => {
    setSchedules(prev => 
      prev.map((schedule, idx) => 
        idx === dayIndex 
          ? {
              ...schedule,
              slots: [...schedule.slots, { start_time: '09:00', end_time: '17:00' }]
            }
          : schedule
      )
    )
  }

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    setSchedules(prev => 
      prev.map((schedule, idx) => 
        idx === dayIndex 
          ? {
              ...schedule,
              slots: schedule.slots.filter((_, sIdx) => sIdx !== slotIndex)
            }
          : schedule
      )
    )
  }

  const updateTimeSlot = (dayIndex: number, slotIndex: number, field: 'start_time' | 'end_time', value: string) => {
    setSchedules(prev => 
      prev.map((schedule, idx) => 
        idx === dayIndex 
          ? {
              ...schedule,
              slots: schedule.slots.map((slot, sIdx) => 
                sIdx === slotIndex ? { ...slot, [field]: value } : slot
              )
            }
          : schedule
      )
    )
  }

  const saveAvailability = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Delete existing availability
      const { error: deleteError } = await supabase
        .from('provider_availability')
        .delete()
        .eq('provider_id', providerId)

      if (deleteError) throw deleteError

      // Insert new availability
      const availabilityRecords = schedules.flatMap(schedule => 
        schedule.slots.map(slot => ({
          provider_id: providerId,
          day_of_week: schedule.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_recurring: true,
          timezone: 'America/Denver'
        }))
      )

      if (availabilityRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('provider_availability')
          .insert(availabilityRecords)

        if (insertError) throw insertError
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      console.error('Error saving availability:', err)
      setError('Failed to save availability. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addException = async () => {
    if (!newException.exception_date) return

    try {
      const { error } = await supabase
        .from('provider_availability_exceptions')
        .insert({
          provider_id: providerId,
          ...newException
        })

      if (error) throw error

      setNewException({
        exception_date: '',
        exception_type: 'unavailable',
        start_time: '',
        end_time: '',
        reason: ''
      })
      
      router.refresh()
    } catch (err) {
      console.error('Error adding exception:', err)
      setError('Failed to add exception. Please try again.')
    }
  }

  const deleteException = async (exceptionId: string) => {
    try {
      const { error } = await supabase
        .from('provider_availability_exceptions')
        .delete()
        .eq('id', exceptionId)

      if (error) throw error
      
      router.refresh()
    } catch (err) {
      console.error('Error deleting exception:', err)
      setError('Failed to delete exception. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          Availability updated successfully!
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-stone-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'weekly'
                ? 'border-[#BF9C73] text-[#BF9C73]'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }`}
          >
            Weekly Schedule
          </button>
          <button
            onClick={() => setActiveTab('exceptions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'exceptions'
                ? 'border-[#BF9C73] text-[#BF9C73]'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }`}
          >
            Time Off & Exceptions
          </button>
        </nav>
      </div>

      {/* Weekly Schedule Tab */}
      {activeTab === 'weekly' && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
              Weekly Schedule
            </h2>

            <div className="space-y-6">
              {DAYS.map((day, dayIndex) => {
                const schedule = schedules[dayIndex]
                return (
                  <div key={day.value} className="border border-stone-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-[#091747]">{day.name}</h3>
                      <button
                        onClick={() => addTimeSlot(dayIndex)}
                        className="flex items-center text-sm text-[#BF9C73] hover:text-[#BF9C73]/80"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Time Block
                      </button>
                    </div>

                    {schedule.slots.length === 0 ? (
                      <p className="text-stone-500 text-sm">Not available</p>
                    ) : (
                      <div className="space-y-3">
                        {schedule.slots.map((slot, slotIndex) => (
                          <div key={slotIndex} className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-stone-400" />
                              <input
                                type="time"
                                value={slot.start_time}
                                onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'start_time', e.target.value)}
                                className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                              />
                              <span className="text-stone-500">to</span>
                              <input
                                type="time"
                                value={slot.end_time}
                                onChange={(e) => updateTimeSlot(dayIndex, slotIndex, 'end_time', e.target.value)}
                                className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                              />
                            </div>
                            <button
                              onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end mt-6 pt-6 border-t border-stone-200">
              <button
                onClick={saveAvailability}
                disabled={loading}
                className="flex items-center px-6 py-3 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exceptions Tab */}
      {activeTab === 'exceptions' && (
        <div className="space-y-6">
          {/* Add New Exception */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
              Add Time Off
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={newException.exception_date}
                  onChange={(e) => setNewException(prev => ({ ...prev, exception_date: e.target.value }))}
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Type
                </label>
                <select
                  value={newException.exception_type}
                  onChange={(e) => setNewException(prev => ({ ...prev, exception_type: e.target.value as 'unavailable' | 'custom_hours' }))}
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                >
                  <option value="unavailable">Unavailable (All Day)</option>
                  <option value="custom_hours">Custom Hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={newException.reason}
                  onChange={(e) => setNewException(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Vacation, Conference, etc."
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>
            </div>

            {newException.exception_type === 'custom_hours' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#091747] mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newException.start_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#091747] mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newException.end_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              onClick={addException}
              disabled={!newException.exception_date}
              className="flex items-center px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Exception
            </button>
          </div>

          {/* Existing Exceptions */}
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
              Scheduled Time Off
            </h2>

            {exceptions.length === 0 ? (
              <p className="text-stone-500">No scheduled time off.</p>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exception) => (
                  <div key={exception.id} className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-5 w-5 text-stone-400" />
                      <div>
                        <p className="font-medium text-[#091747]">
                          {new Date(exception.exception_date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-stone-600">
                          {exception.exception_type === 'unavailable' 
                            ? 'Unavailable all day'
                            : `${exception.start_time} - ${exception.end_time}`
                          }
                          {exception.reason && ` • ${exception.reason}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteException(exception.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
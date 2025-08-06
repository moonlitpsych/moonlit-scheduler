'use client'

import ExceptionManager from '@/components/providers/ExceptionManager'
import WeeklyScheduleEditor from '@/components/providers/WeeklyScheduleEditor'
import { AlertCircle, Calendar, CheckCircle, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DaySchedule {
  day_of_week: number
  day_name: string
  slots: Array<{
    id?: string
    start_time: string
    end_time: string
  }>
  is_available: boolean
}

interface AvailabilityException {
  id?: string
  provider_id: string
  exception_date: string
  exception_type: 'unavailable' | 'custom_hours'
  start_time?: string
  end_time?: string
  reason?: string
}

interface ProviderAvailabilityManagerProps {
  providerId: string
}

export default function ProviderAvailabilityManager({ providerId }: ProviderAvailabilityManagerProps) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'exceptions'>('schedule')
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([])
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load initial data
  useEffect(() => {
    loadProviderAvailability()
  }, [providerId])

  const loadProviderAvailability = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load weekly schedule and exceptions in parallel
      const [scheduleResponse, exceptionsResponse] = await Promise.all([
        fetch(`/api/providers/${providerId}/availability?type=weekly`),
        fetch(`/api/providers/${providerId}/availability?type=exceptions`)
      ])

      if (!scheduleResponse.ok || !exceptionsResponse.ok) {
        throw new Error('Failed to load availability data')
      }

      const scheduleData = await scheduleResponse.json()
      const exceptionsData = await exceptionsResponse.json()

      if (scheduleData.success) {
        setWeeklySchedule(scheduleData.data)
      }

      if (exceptionsData.success) {
        setExceptions(exceptionsData.data)
      }

    } catch (err) {
      console.error('Error loading provider availability:', err)
      setError('Failed to load your availability settings. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWeeklySchedule = async (schedule: DaySchedule[]) => {
    try {
      const response = await fetch(`/api/providers/${providerId}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'weekly-schedule',
          data: {
            schedule,
            timezone: 'America/Denver'
          }
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save schedule')
      }

      // Update local state
      setWeeklySchedule(schedule)

    } catch (err) {
      console.error('Error saving weekly schedule:', err)
      throw new Error('Failed to save your schedule. Please try again.')
    }
  }

  const handleAddException = async (exception: Omit<AvailabilityException, 'id' | 'provider_id'>) => {
    try {
      const response = await fetch(`/api/providers/${providerId}/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'exception',
          data: exception
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to add exception')
      }

      // Reload exceptions
      await loadProviderAvailability()

    } catch (err) {
      console.error('Error adding exception:', err)
      throw new Error('Failed to add exception. Please try again.')
    }
  }

  const handleRemoveException = async (exceptionId: string) => {
    try {
      const response = await fetch(`/api/providers/${providerId}/availability/exceptions/${exceptionId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to remove exception')
      }

      // Update local state
      setExceptions(prev => prev.filter(e => e.id !== exceptionId))

    } catch (err) {
      console.error('Error removing exception:', err)
      throw new Error('Failed to remove exception. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#BF9C73] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#091747]/70">Loading your availability settings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-medium">Error Loading Availability</h3>
        </div>
        <p className="text-red-600/80 mb-4">{error}</p>
        <button
          onClick={loadProviderAvailability}
          className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <nav className="flex border-b border-stone-200">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors
              ${activeTab === 'schedule'
                ? 'border-[#BF9C73] text-[#BF9C73]'
                : 'border-transparent text-[#091747]/70 hover:text-[#091747] hover:border-[#BF9C73]/30'
              }
            `}
          >
            <Clock className="w-5 h-5" />
            Weekly Schedule
          </button>

          <button
            onClick={() => setActiveTab('exceptions')}
            className={`
              flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors
              ${activeTab === 'exceptions'
                ? 'border-[#BF9C73] text-[#BF9C73]'
                : 'border-transparent text-[#091747]/70 hover:text-[#091747] hover:border-[#BF9C73]/30'
              }
            `}
          >
            <Calendar className="w-5 h-5" />
            Time Off & Exceptions
            {exceptions.length > 0 && (
              <span className="bg-[#BF9C73] text-white text-xs px-2 py-1 rounded-full">
                {exceptions.length}
              </span>
            )}
          </button>
        </nav>

        <div className="p-6">
          {activeTab === 'schedule' && (
            <div>
              <WeeklyScheduleEditor
                providerId={providerId}
                initialSchedule={weeklySchedule}
                onSave={handleSaveWeeklySchedule}
              />
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div>
              <ExceptionManager
                providerId={providerId}
                exceptions={exceptions}
                onAddException={handleAddException}
                onRemoveException={handleRemoveException}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#BF9C73]/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-[#091747]/70">Weekly Hours Set</p>
              <p className="text-lg font-semibold text-[#091747]">
                {weeklySchedule.reduce((total, day) => 
                  total + day.slots.reduce((dayTotal, slot) => {
                    const start = new Date(`1970-01-01T${slot.start_time}:00`)
                    const end = new Date(`1970-01-01T${slot.end_time}:00`)
                    return dayTotal + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                  }, 0), 0
                ).toFixed(1)} hours
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-[#091747]/70">Available Days</p>
              <p className="text-lg font-semibold text-[#091747]">
                {weeklySchedule.filter(day => day.is_available).length} / 7
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-[#091747]/70">Upcoming Exceptions</p>
              <p className="text-lg font-semibold text-[#091747]">
                {exceptions.filter(e => new Date(e.exception_date) >= new Date()).length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
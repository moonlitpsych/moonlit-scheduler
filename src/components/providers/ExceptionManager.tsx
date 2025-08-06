'use client'

import { AvailabilityException } from '@/services/providerAvailabilityService'
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface ExceptionManagerProps {
  providerId: string
  exceptions: AvailabilityException[]
  onAddException: (exception: Omit<AvailabilityException, 'id' | 'provider_id'>) => Promise<void>
  onRemoveException: (exceptionId: string) => Promise<void>
}

export default function ExceptionManager({ 
  providerId, 
  exceptions, 
  onAddException, 
  onRemoveException 
}: ExceptionManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null) // ID of exception being processed
  const [newException, setNewException] = useState({
    exception_date: '',
    exception_type: 'unavailable' as const,
    start_time: '',
    end_time: '',
    reason: ''
  })

  const handleAddException = async () => {
    if (!newException.exception_date) return

    try {
      setLoading('adding')
      await onAddException(newException)
      
      // Reset form
      setNewException({
        exception_date: '',
        exception_type: 'unavailable',
        start_time: '',
        end_time: '',
        reason: ''
      })
      setShowAddForm(false)
    } catch (error) {
      // Error handling is done by parent component
      console.error('Failed to add exception:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleRemoveException = async (exceptionId: string) => {
    try {
      setLoading(exceptionId)
      await onRemoveException(exceptionId)
    } catch (error) {
      // Error handling is done by parent component
      console.error('Failed to remove exception:', error)
    } finally {
      setLoading(null)
    }
  }

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
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Sort exceptions by date
  const sortedExceptions = [...exceptions].sort((a, b) => 
    new Date(a.exception_date).getTime() - new Date(b.exception_date).getTime()
  )

  // Group exceptions by past/upcoming
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const upcomingExceptions = sortedExceptions.filter(
    e => new Date(e.exception_date) >= today
  )
  const pastExceptions = sortedExceptions.filter(
    e => new Date(e.exception_date) < today
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
            Time Off & Schedule Exceptions
          </h3>
          <p className="text-sm text-[#091747]/70">
            Block time for vacations, holidays, or set custom hours for specific dates
          </p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Exception
        </button>
      </div>

      {/* Add Exception Form */}
      {showAddForm && (
        <div className="bg-[#F6B398]/10 border border-[#BF9C73]/30 rounded-lg p-6">
          <h4 className="font-medium text-[#091747] mb-4">Add Schedule Exception</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label htmlFor="exception-date" className="block text-sm font-medium text-[#091747] mb-2">
                Date
              </label>
              <input
                id="exception-date"
                type="date"
                value={newException.exception_date}
                onChange={(e) => setNewException(prev => ({ ...prev, exception_date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]} // Can't add exceptions in the past
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
              />
            </div>

            {/* Exception Type */}
            <div>
              <label htmlFor="exception-type" className="block text-sm font-medium text-[#091747] mb-2">
                Exception Type
              </label>
              <select
                id="exception-type"
                value={newException.exception_type}
                onChange={(e) => setNewException(prev => ({ 
                  ...prev, 
                  exception_type: e.target.value as 'unavailable' | 'custom_hours'
                }))}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
              >
                <option value="unavailable">Completely Unavailable</option>
                <option value="custom_hours">Custom Hours</option>
              </select>
            </div>

            {/* Custom Hours (only show if custom_hours selected) */}
            {newException.exception_type === 'custom_hours' && (
              <>
                <div>
                  <label htmlFor="start-time" className="block text-sm font-medium text-[#091747] mb-2">
                    Start Time
                  </label>
                  <input
                    id="start-time"
                    type="time"
                    value={newException.start_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="end-time" className="block text-sm font-medium text-[#091747] mb-2">
                    End Time
                  </label>
                  <input
                    id="end-time"
                    type="time"
                    value={newException.end_time}
                    onChange={(e) => setNewException(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Reason */}
            <div className="md:col-span-2">
              <label htmlFor="reason" className="block text-sm font-medium text-[#091747] mb-2">
                Reason (Optional)
              </label>
              <input
                id="reason"
                type="text"
                value={newException.reason}
                onChange={(e) => setNewException(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Vacation, Conference, Medical appointment"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewException({
                  exception_date: '',
                  exception_type: 'unavailable',
                  start_time: '',
                  end_time: '',
                  reason: ''
                })
              }}
              className="px-4 py-2 text-[#091747]/70 hover:text-[#091747] transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleAddException}
              disabled={!newException.exception_date || loading === 'adding'}
              className="bg-[#BF9C73] hover:bg-[#A88861] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              {loading === 'adding' ? 'Adding...' : 'Add Exception'}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Exceptions */}
      {upcomingExceptions.length > 0 && (
        <div>
          <h4 className="font-medium text-[#091747] mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Exceptions
          </h4>
          
          <div className="space-y-3">
            {upcomingExceptions.map((exception) => (
              <div key={exception.id} className="bg-white border border-stone-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        exception.exception_type === 'unavailable' 
                          ? 'bg-red-500' 
                          : 'bg-orange-500'
                      }`} />
                      
                      <p className="font-medium text-[#091747]">
                        {formatDate(exception.exception_date)}
                      </p>
                      
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        exception.exception_type === 'unavailable'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {exception.exception_type === 'unavailable' ? 'Unavailable' : 'Custom Hours'}
                      </span>
                    </div>
                    
                    {exception.exception_type === 'custom_hours' && exception.start_time && exception.end_time && (
                      <p className="text-sm text-[#091747]/70 flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(exception.start_time)} - {formatTime(exception.end_time)}
                      </p>
                    )}
                    
                    {exception.reason && (
                      <p className="text-sm text-[#091747]/70">
                        {exception.reason}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => exception.id && handleRemoveException(exception.id)}
                    disabled={loading === exception.id}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove exception"
                  >
                    {loading === exception.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Exceptions */}
      {pastExceptions.length > 0 && (
        <div>
          <h4 className="font-medium text-[#091747]/70 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Past Exceptions
          </h4>
          
          <div className="space-y-2">
            {pastExceptions.slice(0, 5).map((exception) => (
              <div key={exception.id} className="bg-stone-50 border border-stone-200 rounded-lg p-3 opacity-60">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    exception.exception_type === 'unavailable' 
                      ? 'bg-red-400' 
                      : 'bg-orange-400'
                  }`} />
                  
                  <p className="text-sm text-[#091747]/70">
                    {formatDate(exception.exception_date)}
                  </p>
                  
                  {exception.reason && (
                    <>
                      <span className="text-[#091747]/40">•</span>
                      <p className="text-sm text-[#091747]/70">
                        {exception.reason}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
            
            {pastExceptions.length > 5 && (
              <p className="text-sm text-[#091747]/50 text-center py-2">
                And {pastExceptions.length - 5} more past exceptions...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {exceptions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-[#BF9C73]" />
          </div>
          <h3 className="font-medium text-[#091747] mb-2">No Exceptions Set</h3>
          <p className="text-[#091747]/70 mb-4">
            You haven't set any time off or schedule exceptions yet.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors"
          >
            Add Your First Exception
          </button>
        </div>
      )}
    </div>
  )
}
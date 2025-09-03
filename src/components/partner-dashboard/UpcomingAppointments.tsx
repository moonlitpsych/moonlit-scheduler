// Partner Dashboard Upcoming Appointments Component
'use client'

import { useState } from 'react'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  providers: {
    id: string
    first_name: string
    last_name: string
    title?: string
  }
  patients: {
    id: string
    first_name: string
    last_name: string
    phone?: string
  }
  payers?: {
    id: string
    name: string
  }
}

interface UpcomingAppointmentsProps {
  appointments: Appointment[]
  loading?: boolean
  onRequestChange?: (appointmentId: string) => void
}

export function UpcomingAppointments({ 
  appointments, 
  loading = false,
  onRequestChange 
}: UpcomingAppointmentsProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    
    let dateLabel = ''
    if (isToday) {
      dateLabel = 'Today'
    } else if (isTomorrow) {
      dateLabel = 'Tomorrow'
    } else {
      dateLabel = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    }
    
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
    
    return `${dateLabel} at ${time}`
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-moonlit-peach/20 text-moonlit-navy border-moonlit-peach/40'
      case 'scheduled':
        return 'bg-moonlit-brown/10 text-moonlit-brown border-moonlit-brown/30'
      case 'pending':
        return 'bg-moonlit-orange/10 text-moonlit-orange border-moonlit-orange/30'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPatientInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-moonlit-navy mb-6 font-['Newsreader']">Upcoming Appointments</h2>
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="animate-pulse border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="w-24 h-6 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!appointments || appointments.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-moonlit-navy mb-6 font-['Newsreader']">Upcoming Appointments</h2>
        <div className="text-center py-8">
          <div className="text-gray-400 text-6xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2 font-['Newsreader']">No upcoming appointments</h3>
          <p className="text-gray-500 font-['Newsreader'] font-light">
            Your patients don't have any scheduled appointments in the coming days.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#091747]">Upcoming Appointments</h2>
        <span className="text-sm text-gray-500">
          {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {appointments.slice(0, 10).map((appointment) => (
          <div
            key={appointment.id}
            className={`border border-gray-200 rounded-lg p-4 transition-all hover:shadow-sm ${
              selectedAppointment === appointment.id ? 'ring-2 ring-[#BF9C73] border-[#BF9C73]' : ''
            }`}
            onClick={() => setSelectedAppointment(
              selectedAppointment === appointment.id ? null : appointment.id
            )}
          >
            {/* Main appointment info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Patient avatar */}
                <div className="w-12 h-12 bg-moonlit-navy rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {getPatientInitials(appointment.patients.first_name, appointment.patients.last_name)}
                  </span>
                </div>
                
                {/* Patient and time info */}
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium text-gray-900 font-['Newsreader']">
                      {appointment.patients.first_name} {appointment.patients.last_name}
                    </h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(appointment.status)}`}>
                      {appointment.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 font-['Newsreader']">
                    {formatDateTime(appointment.start_time)}
                  </p>
                  <p className="text-sm text-gray-500 font-['Newsreader'] font-light">
                    with Dr. {appointment.providers.first_name} {appointment.providers.last_name}
                  </p>
                </div>
              </div>

              {/* Action button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRequestChange?.(appointment.id)
                }}
                className="text-moonlit-brown hover:text-moonlit-brown-hover text-sm font-medium font-['Newsreader']"
              >
                Request Change
              </button>
            </div>

            {/* Expanded details */}
            {selectedAppointment === appointment.id && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 font-['Newsreader']">Duration:</span>
                    <p className="text-gray-600 font-['Newsreader']">
                      {Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / (1000 * 60))} minutes
                    </p>
                  </div>
                  {appointment.patients.phone && (
                    <div>
                      <span className="font-medium text-gray-700 font-['Newsreader']">Patient Phone:</span>
                      <p className="text-gray-600 font-['Newsreader']">{appointment.patients.phone}</p>
                    </div>
                  )}
                  {appointment.payers && (
                    <div>
                      <span className="font-medium text-gray-700 font-['Newsreader']">Insurance:</span>
                      <p className="text-gray-600 font-['Newsreader']">{appointment.payers.name}</p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRequestChange?.(appointment.id)
                    }}
                    className="inline-flex items-center px-3 py-2 border border-moonlit-brown text-moonlit-brown text-sm font-medium font-['Newsreader'] rounded-md hover:bg-moonlit-cream transition-colors"
                  >
                    Request Reschedule
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Handle cancellation
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium font-['Newsreader'] rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Request Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {appointments.length > 10 && (
        <div className="mt-6 text-center">
          <button className="text-moonlit-brown hover:text-moonlit-brown-hover font-medium font-['Newsreader']">
            View all {appointments.length} appointments →
          </button>
        </div>
      )}
    </div>
  )
}
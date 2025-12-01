// Partner Dashboard Upcoming Appointments Component
'use client'

import { useState } from 'react'
import { Download, Calendar, Video, VideoOff, ExternalLink, Check, Copy, Edit2, X } from 'lucide-react'
import { useAppointmentExport } from '@/hooks/useAppointmentExport'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  practiceq_generated_google_meet?: string | null
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
  onAppointmentUpdate?: (appointmentId: string, updates: Partial<Appointment>) => void
}

export function UpcomingAppointments({
  appointments,
  loading = false,
  onAppointmentUpdate
}: UpcomingAppointmentsProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [editingMeetLink, setEditingMeetLink] = useState<string | null>(null)
  const [meetLinkInput, setMeetLinkInput] = useState('')
  const [savingMeetLink, setSavingMeetLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [savedLink, setSavedLink] = useState<string | null>(null)
  const { exportSingleAppointment, exportStatus, exportMessage } = useAppointmentExport()

  // Local state to track updated meet links (for optimistic UI)
  const [localMeetLinks, setLocalMeetLinks] = useState<Record<string, string | null>>({})

  const getMeetLink = (appointment: Appointment) => {
    return localMeetLinks[appointment.id] !== undefined
      ? localMeetLinks[appointment.id]
      : appointment.practiceq_generated_google_meet
  }

  const handleCopyMeetLink = async (appointmentId: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(appointmentId)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleEditMeetLink = (appointment: Appointment) => {
    setEditingMeetLink(appointment.id)
    setMeetLinkInput(getMeetLink(appointment) || '')
  }

  const handleSaveMeetLink = async (appointmentId: string) => {
    setSavingMeetLink(true)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/update-google-meet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMeetLink: meetLinkInput.trim() || null })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      // Update local state
      setLocalMeetLinks(prev => ({
        ...prev,
        [appointmentId]: meetLinkInput.trim() || null
      }))

      // Notify parent if callback provided
      if (onAppointmentUpdate) {
        onAppointmentUpdate(appointmentId, {
          practiceq_generated_google_meet: meetLinkInput.trim() || null
        })
      }

      setEditingMeetLink(null)
      setSavedLink(appointmentId)
      setTimeout(() => setSavedLink(null), 3000)
    } catch (err: any) {
      console.error('Error saving meet link:', err)
      alert(err.message || 'Failed to save Google Meet link')
    } finally {
      setSavingMeetLink(false)
    }
  }

  const handleCancelEditMeetLink = () => {
    setEditingMeetLink(null)
    setMeetLinkInput('')
  }

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
                  {appointment.providers && (
                    <p className="text-sm text-gray-500 font-['Newsreader'] font-light">
                      with Dr. {appointment.providers.first_name} {appointment.providers.last_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Google Meet indicator */}
              <div className="flex items-center">
                {getMeetLink(appointment) ? (
                  <div className="flex items-center gap-1 text-green-600" title="Google Meet link available">
                    <Video className="w-5 h-5" />
                    <span className="text-xs font-medium hidden sm:inline">Meet Ready</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-500" title="No Google Meet link - click to add">
                    <VideoOff className="w-5 h-5" />
                    <span className="text-xs font-medium hidden sm:inline">No Meet</span>
                  </div>
                )}
              </div>
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

                {/* Google Meet Link Section */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 font-['Newsreader'] flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Google Meet Link
                    </span>
                    {savedLink === appointment.id && (
                      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Saved!
                      </span>
                    )}
                  </div>

                  {editingMeetLink === appointment.id ? (
                    // Edit mode
                    <div className="mt-2 space-y-2">
                      <input
                        type="url"
                        value={meetLinkInput}
                        onChange={(e) => setMeetLinkInput(e.target.value)}
                        placeholder="https://meet.google.com/xxx-xxxx-xxx"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                        disabled={savingMeetLink}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveMeetLink(appointment.id)}
                          disabled={savingMeetLink}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingMeetLink ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              Save
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelEditMeetLink}
                          disabled={savingMeetLink}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <div className="mt-2">
                      {getMeetLink(appointment) ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={getMeetLink(appointment)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {getMeetLink(appointment)}
                          </a>
                          <button
                            onClick={() => handleCopyMeetLink(appointment.id, getMeetLink(appointment)!)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Copy link"
                          >
                            {copiedLink === appointment.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditMeetLink(appointment)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Edit link"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditMeetLink(appointment)}
                          className="text-sm text-moonlit-brown hover:text-moonlit-brown/80 flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Add Google Meet link
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  {/* Individual Export Buttons */}
                  <div className="flex items-center space-x-2 ml-auto">
                    <span className="text-xs text-gray-500 font-['Newsreader']">Export to:</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        exportSingleAppointment(appointment, 'ics')
                      }}
                      disabled={exportStatus === 'loading'}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-moonlit-brown hover:bg-moonlit-cream rounded transition-colors disabled:opacity-50"
                      title="Export to iCalendar (.ics)"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      iCal
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        exportSingleAppointment(appointment, 'outlook')
                      }}
                      disabled={exportStatus === 'loading'}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-moonlit-brown hover:bg-moonlit-cream rounded transition-colors disabled:opacity-50"
                      title="Export to Outlook CSV"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Outlook
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        exportSingleAppointment(appointment, 'google')
                      }}
                      disabled={exportStatus === 'loading'}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-moonlit-brown hover:bg-moonlit-cream rounded transition-colors disabled:opacity-50"
                      title="Export to Google CSV"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Google
                    </button>
                  </div>
                </div>
                
                {/* Export Status Message */}
                {exportStatus !== 'idle' && exportMessage && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    exportStatus === 'loading' ? 'bg-blue-50 text-blue-800' :
                    exportStatus === 'success' ? 'bg-green-50 text-green-800' :
                    'bg-red-50 text-red-800'
                  }`}>
                    {exportMessage}
                  </div>
                )}
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
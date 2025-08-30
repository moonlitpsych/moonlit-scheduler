'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Calendar, Clock, Video, Phone, FileText, Users, Plus, Filter } from 'lucide-react'

interface Patient {
  id: string
  name: string
  email?: string
  phone?: string
  mrn?: string
  dob?: string
  source: 'intakeq' | 'moonlit'
}

interface Appointment {
  id: string
  patient_id: string
  provider_id: string
  start_time: string
  end_time: string
  appointment_type: 'initial' | 'follow-up' | 'consultation'
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  visit_type: 'in-person' | 'virtual'
  google_meet_link?: string
  notes?: string
  patient?: Patient
  created_at: string
}

interface AppointmentManagerProps {
  providerId?: string
  onAppointmentSelect?: (appointment: Appointment) => void
}

export default function AppointmentManager({ providerId, onAppointmentSelect }: AppointmentManagerProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('upcoming')
  const [searchTerm, setSearchTerm] = useState('')
  
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    loadAppointments()
  }, [filter, providerId])

  const loadAppointments = async () => {
    if (!providerId) return

    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patient_id (
            id,
            name,
            email,
            phone,
            mrn,
            dob
          )
        `)
        .eq('provider_id', providerId)
        .order('start_time', { ascending: true })

      // Apply date filters
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

      if (filter === 'today') {
        query = query
          .gte('start_time', today.toISOString())
          .lt('start_time', tomorrow.toISOString())
      } else if (filter === 'upcoming') {
        query = query
          .gte('start_time', now.toISOString())
          .neq('status', 'completed')
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setAppointments(data || [])
    } catch (err: any) {
      console.error('Error loading appointments:', err)
      setError('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    const patientName = appointment.patient?.name?.toLowerCase() || ''
    const patientEmail = appointment.patient?.email?.toLowerCase() || ''
    return patientName.includes(searchLower) || patientEmail.includes(searchLower)
  })

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      case 'no-show': return 'bg-orange-100 text-orange-700'
      default: return 'bg-stone-100 text-stone-700'
    }
  }

  const getAppointmentTypeIcon = (type: string, visitType: string) => {
    if (visitType === 'virtual') {
      return <Video className="w-4 h-4 text-blue-600" />
    }
    return <Users className="w-4 h-4 text-[#BF9C73]" />
  }

  const handleStartMeeting = (appointment: Appointment) => {
    if (appointment.google_meet_link) {
      window.open(appointment.google_meet_link, '_blank')
    } else {
      // Create Google Meet link logic would go here
      console.log('Create Google Meet link for appointment:', appointment.id)
    }
  }

  const canGenerateNotes = (appointment: Appointment) => {
    return appointment.status === 'completed' && !appointment.notes
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Appointments
        </h3>
        <p className="text-sm text-[#091747]/60">
          Manage your scheduled appointments and generate clinical notes
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {[
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'today', label: 'Today' },
              { key: 'completed', label: 'Completed' },
              { key: 'all', label: 'All' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-[#091747]/60 hover:text-[#091747]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patients..."
              className="w-full pl-4 pr-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent font-['Newsreader']"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
          <p className="mt-2 text-[#091747]/60 font-['Newsreader']">Loading appointments...</p>
        </div>
      )}

      {/* No Results */}
      {!loading && filteredAppointments.length === 0 && (
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-[#091747]/30 mx-auto mb-4" />
          <p className="text-[#091747]/60 font-['Newsreader']">
            {appointments.length === 0 
              ? 'No appointments found for the selected filter.'
              : 'No appointments match your search.'
            }
          </p>
        </div>
      )}

      {/* Appointments List */}
      {filteredAppointments.length > 0 && (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              onClick={() => onAppointmentSelect?.(appointment)}
              className="p-4 border border-stone-200 rounded-lg hover:border-[#BF9C73]/30 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Patient Info */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-[#BF9C73]/10 flex items-center justify-center group-hover:bg-[#BF9C73]/20 transition-colors">
                      <span className="text-sm font-medium text-[#BF9C73]">
                        {appointment.patient?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-[#091747] font-['Newsreader']">
                        {appointment.patient?.name || 'Unknown Patient'}
                      </h4>
                      <p className="text-sm text-[#091747]/60">
                        {appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1)} Appointment
                      </p>
                    </div>
                  </div>

                  {/* Appointment Details */}
                  <div className="flex items-center gap-4 text-sm text-[#091747]/60 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(appointment.start_time)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                    </div>
                    <div className="flex items-center gap-1">
                      {getAppointmentTypeIcon(appointment.appointment_type, appointment.visit_type)}
                      {appointment.visit_type === 'virtual' ? 'Virtual' : 'In-Person'}
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(appointment.status)}`}>
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Virtual Visit Actions */}
                      {appointment.visit_type === 'virtual' && appointment.status === 'scheduled' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartMeeting(appointment)
                          }}
                          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" />
                          Start Meeting
                        </button>
                      )}

                      {/* Generate Notes Action */}
                      {canGenerateNotes(appointment) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Generate notes logic would go here
                            console.log('Generate notes for:', appointment.id)
                          }}
                          className="text-xs bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Generate Notes
                        </button>
                      )}

                      {/* View Notes Action */}
                      {appointment.notes && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // View notes logic would go here
                            console.log('View notes for:', appointment.id)
                          }}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          View Notes
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Patient Contact Info */}
              {(appointment.patient?.email || appointment.patient?.phone) && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <div className="flex items-center gap-4 text-xs text-[#091747]/50">
                    {appointment.patient.email && (
                      <div>📧 {appointment.patient.email}</div>
                    )}
                    {appointment.patient.phone && (
                      <div>📞 {appointment.patient.phone}</div>
                    )}
                    {appointment.patient.mrn && (
                      <div className="font-mono">MRN: {appointment.patient.mrn}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {filteredAppointments.length > 0 && (
        <div className="mt-6 pt-4 border-t border-stone-200">
          <p className="text-sm text-[#091747]/60 font-['Newsreader']">
            Showing {filteredAppointments.length} appointments
          </p>
        </div>
      )}
    </div>
  )
}
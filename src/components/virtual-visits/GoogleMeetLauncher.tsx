'use client'

import { useState, useEffect } from 'react'
import { Video, VideoOff, Users, Link, Calendar, Clock, Phone, Copy, ExternalLink, Loader2 } from 'lucide-react'

interface GoogleMeetLauncherProps {
  appointmentId?: string
  patientName?: string
  scheduledTime?: string
  duration?: number
  onMeetingCreated?: (meetingLink: string) => void
  onMeetingEnded?: () => void
}

interface MeetingInfo {
  meetingLink: string
  meetingId: string
  status: 'scheduled' | 'active' | 'ended'
  participantCount: number
  recordingEnabled: boolean
  recordingUrl?: string
  createdAt: string
}

export default function GoogleMeetLauncher({
  appointmentId,
  patientName,
  scheduledTime,
  duration = 45,
  onMeetingCreated,
  onMeetingEnded
}: GoogleMeetLauncherProps) {
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (appointmentId) {
      loadMeetingInfo()
    }
  }, [appointmentId])

  const loadMeetingInfo = async () => {
    if (!appointmentId) return

    try {
      setLoading(true)
      
      // This would call your Google Meet API integration
      // For now, showing mock data structure
      const mockMeetingInfo: MeetingInfo = {
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        meetingId: 'abc-defg-hij',
        status: 'scheduled',
        participantCount: 0,
        recordingEnabled: true,
        createdAt: new Date().toISOString()
      }

      setMeetingInfo(mockMeetingInfo)
    } catch (err: any) {
      console.error('Error loading meeting info:', err)
      setError('Failed to load meeting information')
    } finally {
      setLoading(false)
    }
  }

  const createMeeting = async () => {
    try {
      setLoading(true)
      setError('')

      // This would call your Google Meet API to create a meeting
      const response = await fetch('/api/google-meet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          patientName,
          scheduledTime,
          duration,
          recordingEnabled: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create Google Meet')
      }

      const data = await response.json()
      
      const newMeeting: MeetingInfo = {
        meetingLink: data.meetingLink,
        meetingId: data.meetingId,
        status: 'scheduled',
        participantCount: 0,
        recordingEnabled: true,
        createdAt: new Date().toISOString()
      }

      setMeetingInfo(newMeeting)
      onMeetingCreated?.(newMeeting.meetingLink)
    } catch (err: any) {
      console.error('Error creating meeting:', err)
      setError('Failed to create Google Meet link')
    } finally {
      setLoading(false)
    }
  }

  const joinMeeting = () => {
    if (meetingInfo?.meetingLink) {
      window.open(meetingInfo.meetingLink, '_blank', 'noopener,noreferrer')
      
      // Update status to active
      setMeetingInfo(prev => prev ? { ...prev, status: 'active' } : null)
    }
  }

  const copyMeetingLink = async () => {
    if (meetingInfo?.meetingLink) {
      try {
        await navigator.clipboard.writeText(meetingInfo.meetingLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
    }
  }

  const endMeeting = () => {
    setMeetingInfo(prev => prev ? { ...prev, status: 'ended' } : null)
    onMeetingEnded?.()
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return ''
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timeString?: string) => {
    if (!timeString) return ''
    return new Date(timeString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-full">
          <Video className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#091747] font-['Newsreader']">
            Virtual Visit
          </h3>
          <p className="text-sm text-[#091747]/60">
            HIPAA-compliant Google Meet integration
          </p>
        </div>
      </div>

      {/* Appointment Details */}
      {(patientName || scheduledTime) && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="font-medium text-[#091747] mb-2 font-['Newsreader']">Appointment Details</h4>
          <div className="space-y-2 text-sm text-[#091747]/60">
            {patientName && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Patient: {patientName}</span>
              </div>
            )}
            {scheduledTime && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(scheduledTime)} at {formatTime(scheduledTime)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Duration: {duration} minutes</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Meeting Controls */}
      <div className="space-y-4">
        {/* No Meeting Created */}
        {!meetingInfo && (
          <div className="text-center py-8">
            <VideoOff className="w-12 h-12 text-[#091747]/30 mx-auto mb-4" />
            <h4 className="font-medium text-[#091747] mb-2">No Meeting Link Created</h4>
            <p className="text-sm text-[#091747]/60 mb-6">
              Create a Google Meet link for this appointment
            </p>
            <button
              onClick={createMeeting}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-stone-400 text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 mx-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  Create Meeting
                </>
              )}
            </button>
          </div>
        )}

        {/* Meeting Created */}
        {meetingInfo && (
          <div>
            {/* Meeting Status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  meetingInfo.status === 'active' ? 'bg-green-500' :
                  meetingInfo.status === 'ended' ? 'bg-red-500' : 'bg-blue-500'
                }`}></div>
                <span className="text-sm font-medium text-[#091747] capitalize">
                  {meetingInfo.status}
                </span>
                {meetingInfo.participantCount > 0 && (
                  <span className="text-sm text-[#091747]/60">
                    • {meetingInfo.participantCount} participant{meetingInfo.participantCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="text-xs text-[#091747]/50">
                ID: {meetingInfo.meetingId}
              </div>
            </div>

            {/* Meeting Link */}
            <div className="mb-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-3">
                  <p className="text-sm font-medium text-[#091747] mb-1">Meeting Link</p>
                  <p className="text-xs text-[#091747]/60 font-mono break-all">
                    {meetingInfo.meetingLink}
                  </p>
                </div>
                <button
                  onClick={copyMeetingLink}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    copied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-stone-200 hover:bg-stone-300 text-[#091747]/60'
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {meetingInfo.status !== 'ended' && (
                <button
                  onClick={joinMeeting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  {meetingInfo.status === 'active' ? 'Rejoin Meeting' : 'Start Meeting'}
                </button>
              )}

              {meetingInfo.status === 'active' && (
                <button
                  onClick={endMeeting}
                  className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  End
                </button>
              )}

              <button
                onClick={() => window.open(meetingInfo.meetingLink, '_blank')}
                className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-[#091747] rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
            </div>

            {/* Recording Status */}
            {meetingInfo.recordingEnabled && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800">Recording Enabled</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  This session will be recorded for clinical documentation purposes
                </p>
                {meetingInfo.recordingUrl && (
                  <button className="mt-2 text-xs text-green-700 hover:text-green-800 underline">
                    View Recording
                  </button>
                )}
              </div>
            )}

            {/* Meeting Ended State */}
            {meetingInfo.status === 'ended' && (
              <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#091747]">Meeting Ended</p>
                    <p className="text-xs text-[#091747]/60 mt-1">
                      Ready for clinical note generation
                    </p>
                  </div>
                  <button className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm">
                    Generate Notes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HIPAA Compliance Notice */}
      <div className="mt-6 pt-4 border-t border-stone-200">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
          </div>
          <div>
            <p className="text-sm font-medium text-[#091747]">HIPAA Compliant</p>
            <p className="text-xs text-[#091747]/60 mt-1">
              All video sessions are hosted on Google Workspace for Healthcare with proper data encryption and compliance controls.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
/**
 * Activity Feed Component
 * Displays patient activity timeline
 */

'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle,
  User,
  FileText,
  MessageSquare,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react'

interface Activity {
  id: string
  patient_id: string
  appointment_id?: string
  activity_type: string
  title: string
  description?: string
  metadata?: Record<string, any>
  actor_type?: string
  actor_name?: string
  created_at: string
  patients?: {
    first_name: string
    last_name: string
  }
  appointments?: {
    start_time: string
    status: string
    providers?: {
      first_name: string
      last_name: string
    }
  }
}

interface ActivityFeedProps {
  patientId?: string
  limit?: number
  className?: string
}

export function ActivityFeed({ patientId, limit = 20, className = '' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivities()
  }, [patientId, limit])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = patientId
        ? `/api/partner-dashboard/activity?patient_id=${patientId}&limit=${limit}`
        : `/api/partner-dashboard/activity?limit=${limit}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }

      const data = await response.json()

      if (data.success) {
        setActivities(data.data.activities)
      } else {
        setError(data.error || 'Failed to load activities')
      }
    } catch (err: any) {
      console.error('Error fetching activities:', err)
      setError('Failed to load activity feed')
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'appointment_booked':
      case 'appointment_confirmed':
      case 'appointment_rescheduled':
        return <Calendar className="w-4 h-4" />
      case 'appointment_cancelled':
        return <AlertCircle className="w-4 h-4" />
      case 'roi_granted':
        return <CheckCircle className="w-4 h-4" />
      case 'roi_expired':
        return <AlertCircle className="w-4 h-4" />
      case 'form_sent':
      case 'form_completed':
        return <FileText className="w-4 h-4" />
      case 'reminder_sent':
        return <MessageSquare className="w-4 h-4" />
      case 'case_manager_assigned':
      case 'case_manager_transferred':
        return <User className="w-4 h-4" />
      case 'note_added':
        return <MessageSquare className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'appointment_booked':
      case 'appointment_confirmed':
      case 'roi_granted':
      case 'form_completed':
        return 'text-green-600 bg-green-50'
      case 'appointment_rescheduled':
      case 'reminder_sent':
        return 'text-blue-600 bg-blue-50'
      case 'appointment_cancelled':
      case 'roi_expired':
        return 'text-red-600 bg-red-50'
      case 'form_sent':
      case 'note_added':
        return 'text-gray-600 bg-gray-50'
      case 'case_manager_assigned':
      case 'case_manager_transferred':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return diffMins === 0 ? 'Just now' : `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-['Newsreader']">No activity to display</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {activities.map((activity) => {
        const colorClasses = getActivityColor(activity.activity_type)

        return (
          <div key={activity.id} className="flex space-x-3">
            {/* Icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClasses}`}>
              {getActivityIcon(activity.activity_type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 font-['Newsreader']">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="text-sm text-gray-600 mt-1 font-['Newsreader'] font-light">
                      {activity.description}
                    </p>
                  )}
                  {!patientId && activity.patients && (
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.patients.first_name} {activity.patients.last_name}
                    </p>
                  )}
                  {activity.actor_name && (
                    <p className="text-xs text-gray-500 mt-1">
                      by {activity.actor_name}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-['Newsreader'] font-light ml-2 whitespace-nowrap">
                  {formatTimestamp(activity.created_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Refresh button */}
      <button
        onClick={fetchActivities}
        className="w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Refresh</span>
      </button>
    </div>
  )
}

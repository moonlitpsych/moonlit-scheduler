/**
 * Partner Dashboard - Patient Detail Page
 * Detailed view of a single patient with activity log and ROI management
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { UploadROIModal } from '@/components/partner-dashboard/UploadROIModal'
import { GoogleMeetLinkEditor } from '@/components/shared/GoogleMeetLinkEditor'
import { PartnerUser } from '@/types/partner-types'
import { Database } from '@/types/database'
import { partnerImpersonationManager } from '@/lib/partner-impersonation'
import {
  User,
  ArrowLeft,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Phone,
  Mail,
  CreditCard,
  Clock,
  Download
} from 'lucide-react'
import Link from 'next/link'

interface PatientWithDetails {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  status: string
  primary_insurance_payer?: {
    id: string
    name: string
  }
  affiliation: {
    id: string
    affiliation_type: string
    start_date: string
    consent_on_file: boolean
    consent_expires_on?: string
    consent_status: 'active' | 'expired' | 'missing'
    roi_file_url?: string
    roi_storage_location?: 'uploaded' | 'practiceq'
    primary_contact_user_id?: string
    status: string
  }
  next_appointment?: {
    id: string
    start_time: string
    status: string
    practiceq_generated_google_meet?: string | null
    providers?: {
      first_name: string
      last_name: string
    }
  } | null
  upcoming_appointment_count: number
}

interface ActivityLogEntry {
  id: string
  activity_type: string
  title: string
  description?: string
  created_at: string
  actor_name?: string
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params?.patientId as string

  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null)
  const [patient, setPatient] = useState<PatientWithDetails | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ROI modal state
  const [roiModalOpen, setRoiModalOpen] = useState(false)

  // Fetch partner user and patient data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Get authenticated user
        const supabase = createClientComponentClient<Database>()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Authentication required')
          return
        }

        // Check for admin impersonation
        const impersonation = partnerImpersonationManager.getImpersonatedPartner()
        let partnerData: PartnerUser

        if (impersonation) {
          // Admin is impersonating - use impersonated partner data directly
          const nameParts = impersonation.partner.full_name?.split(' ') || ['', '']
          partnerData = {
            id: impersonation.partner.id,
            auth_user_id: impersonation.partner.auth_user_id,
            organization_id: impersonation.partner.organization_id,
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            full_name: impersonation.partner.full_name,
            email: impersonation.partner.email,
            phone: impersonation.partner.phone,
            role: impersonation.partner.role,
            status: impersonation.partner.is_active ? 'active' : 'inactive',
            timezone: 'America/Denver',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization: impersonation.partner.organization,
            permissions: {},
            organization_stats: undefined
          }
          setPartnerUser(partnerData)
        } else {
          // Regular partner user - fetch from API
          const userResponse = await fetch('/api/partner/me')

          if (!userResponse.ok) {
            setError('Failed to load partner user data')
            return
          }

          const userData = await userResponse.json()
          if (!userData.success) {
            setError(userData.error || 'Failed to load user data')
            return
          }

          partnerData = userData.data
          setPartnerUser(partnerData)
        }

        // Fetch patient details with impersonation support
        const patientsUrl = impersonation
          ? `/api/partner-dashboard/patients?partner_user_id=${impersonation.partner.id}`
          : '/api/partner-dashboard/patients'

        const patientsResponse = await fetch(patientsUrl)
        if (!patientsResponse.ok) {
          setError('Failed to load patient')
          return
        }

        const patientsData = await patientsResponse.json()
        if (!patientsData.success) {
          setError(patientsData.error || 'Failed to load patient')
          return
        }

        const foundPatient = patientsData.data.patients.find((p: PatientWithDetails) => p.id === patientId)
        if (!foundPatient) {
          setError('Patient not found')
          return
        }

        setPatient(foundPatient)

        // Fetch activity log
        const activityResponse = await fetch(`/api/partner-dashboard/patients/${patientId}/activity`)
        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          if (activityData.success) {
            setActivityLog(activityData.data.activities || [])
          }
        }

      } catch (err: any) {
        console.error('Error loading patient:', err)
        setError('Failed to load patient details')
      } finally {
        setLoading(false)
      }
    }

    if (patientId) {
      fetchData()
    }
  }, [patientId])

  const getROIStatusBadge = () => {
    if (!patient) return null

    const { consent_status, roi_file_url, roi_storage_location } = patient.affiliation
    const isClickable = roi_file_url && (consent_status === 'active' || consent_status === 'expired')

    const badgeClasses = isClickable
      ? 'cursor-pointer hover:opacity-80 transition-opacity'
      : ''

    let badge

    switch (consent_status) {
      case 'active':
        badge = (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 ${badgeClasses}`}
            onClick={isClickable ? handleViewROI : undefined}
            title={isClickable ? 'Click to view ROI document' : undefined}
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Active ROI{roi_storage_location === 'practiceq' ? ' (PracticeQ)' : ''}
          </span>
        )
        break
      case 'expired':
        badge = (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 ${badgeClasses}`}
            onClick={isClickable ? handleViewROI : undefined}
            title={isClickable ? 'Click to view ROI document' : undefined}
          >
            <AlertCircle className="w-4 h-4 mr-1.5" />
            Expired ROI{roi_storage_location === 'practiceq' ? ' (PracticeQ)' : ''}
          </span>
        )
        break
      case 'missing':
        badge = (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1.5" />
            No ROI on File
          </span>
        )
        break
      default:
        badge = null
    }

    return badge
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleViewROI = async () => {
    if (!patient?.affiliation.roi_file_url) {
      console.error('No ROI file URL available')
      return
    }

    try {
      // Include impersonation support for viewing ROI
      const impersonation = partnerImpersonationManager.getImpersonatedPartner()
      const partnerUserIdParam = impersonation ? `&partner_user_id=${impersonation.partner.id}` : ''

      const response = await fetch(`/api/partner-dashboard/patients/${patient.id}/roi?action=view${partnerUserIdParam}`, {
        method: 'GET'
      })

      if (!response.ok) {
        console.error('Failed to get ROI document URL')
        return
      }

      const data = await response.json()

      if (data.success && data.data.signedUrl) {
        window.open(data.data.signedUrl, '_blank')
      }
    } catch (err) {
      console.error('Error viewing ROI:', err)
    }
  }

  const handleROISuccess = async () => {
    // Refresh patient data - include impersonation support
    try {
      const impersonation = partnerImpersonationManager.getImpersonatedPartner()
      const patientsUrl = impersonation
        ? `/api/partner-dashboard/patients?partner_user_id=${impersonation.partner.id}`
        : '/api/partner-dashboard/patients'

      const patientsResponse = await fetch(patientsUrl)
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json()
        if (patientsData.success) {
          const foundPatient = patientsData.data.patients.find((p: PatientWithDetails) => p.id === patientId)
          if (foundPatient) {
            setPatient(foundPatient)
          }
        }
      }

      // Refresh activity log - include impersonation support
      const partnerUserIdParam = impersonation ? `?partner_user_id=${impersonation.partner.id}` : ''
      const activityResponse = await fetch(`/api/partner-dashboard/patients/${patientId}/activity${partnerUserIdParam}`)
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        if (activityData.success) {
          setActivityLog(activityData.data.activities || [])
        }
      }
    } catch (err) {
      console.error('Error refreshing patient data:', err)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 mb-4">{error}</p>
            <Link
              href="/partner-dashboard/patients"
              className="text-moonlit-brown hover:underline flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Patient Roster
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !partnerUser || !patient) {
    return (
      <div className="min-h-screen bg-moonlit-cream">
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200"></div>
          <div className="container mx-auto px-4 py-8">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-moonlit-cream">

      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/partner-dashboard/patients"
          className="inline-flex items-center text-moonlit-brown hover:text-moonlit-brown/80 mb-6 font-['Newsreader']"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patient Roster
        </Link>

        {/* Patient header */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-moonlit-cream rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-moonlit-brown" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
                  {patient.first_name} {patient.last_name}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {patient.email && (
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {patient.email}
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      {patient.phone}
                    </div>
                  )}
                  {patient.primary_insurance_payer && (
                    <div className="flex items-center">
                      <CreditCard className="w-4 h-4 mr-1" />
                      {patient.primary_insurance_payer.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ROI Status Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
                  Release of Information (ROI)
                </h2>
                <button
                  onClick={() => setRoiModalOpen(true)}
                  className="px-4 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 font-medium font-['Newsreader'] transition-colors flex items-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Update ROI</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  {getROIStatusBadge()}
                </div>

                {patient.affiliation.consent_expires_on && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Expiration Date:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatShortDate(patient.affiliation.consent_expires_on)}
                    </span>
                  </div>
                )}

                {patient.affiliation.roi_storage_location && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Storage Location:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {patient.affiliation.roi_storage_location === 'practiceq' ? 'PracticeQ' : 'Uploaded to our system'}
                    </span>
                  </div>
                )}

                {patient.affiliation.roi_file_url && patient.affiliation.roi_storage_location === 'uploaded' && (
                  <button
                    onClick={handleViewROI}
                    className="w-full mt-4 px-4 py-2 border border-moonlit-brown text-moonlit-brown rounded-lg hover:bg-moonlit-cream/30 font-medium font-['Newsreader'] transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>View ROI Document</span>
                  </button>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-moonlit-navy mb-4 font-['Newsreader']">
                Activity Log
              </h2>

              {activityLog.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-['Newsreader']">No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityLog.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-0">
                      <div className="flex-shrink-0 w-2 h-2 bg-moonlit-brown rounded-full mt-2"></div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 font-['Newsreader']">{activity.title}</p>
                            {activity.description && (
                              <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                            {formatShortDate(activity.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Next Appointment Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-moonlit-navy mb-4 font-['Newsreader']">
                Next Appointment
              </h2>

              {patient.next_appointment ? (
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-5 h-5 text-moonlit-brown mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {formatDate(patient.next_appointment.start_time)}
                      </p>
                      {patient.next_appointment.providers && (
                        <p className="text-sm text-gray-600 mt-1">
                          with Dr. {patient.next_appointment.providers.last_name}
                        </p>
                      )}
                      <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {patient.next_appointment.status}
                      </span>
                    </div>
                  </div>

                  {/* Google Meet Link Editor */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <GoogleMeetLinkEditor
                      appointmentId={patient.next_appointment.id}
                      currentLink={patient.next_appointment.practiceq_generated_google_meet || null}
                      onUpdate={(newLink) => {
                        // Update local state
                        setPatient(prev => prev ? {
                          ...prev,
                          next_appointment: prev.next_appointment ? {
                            ...prev.next_appointment,
                            practiceq_generated_google_meet: newLink
                          } : null
                        } : null)
                      }}
                    />
                  </div>

                  {patient.upcoming_appointment_count > 1 && (
                    <p className="text-sm text-gray-600 mt-4">
                      + {patient.upcoming_appointment_count - 1} more upcoming
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm font-['Newsreader']">No upcoming appointments</p>
                </div>
              )}
            </div>

            {/* Affiliation Info Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-moonlit-navy mb-4 font-['Newsreader']">
                Affiliation Details
              </h2>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {patient.affiliation.affiliation_type.replace('_', ' ')}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-medium text-gray-900">
                    {formatShortDate(patient.affiliation.start_date)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    patient.affiliation.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.affiliation.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload ROI Modal */}
      {partnerUser && (
        <UploadROIModal
          patient={patient}
          organizationId={partnerUser.organization_id}
          isOpen={roiModalOpen}
          onClose={() => setRoiModalOpen(false)}
          onSuccess={handleROISuccess}
        />
      )}
    </div>
  )
}

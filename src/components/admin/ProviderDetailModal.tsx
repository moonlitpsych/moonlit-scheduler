/**
 * Provider Detail Modal Component
 *
 * Displays comprehensive provider information in read-only mode
 * with tabs for Profile, Statistics, and Integration IDs
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Edit, Loader2, User, BarChart3, Link as LinkIcon, CheckCircle, XCircle } from 'lucide-react'
import { formatPhoneNumber } from '@/lib/utils/phoneNormalizer'

interface ProviderDetailModalProps {
  providerId: string
  onClose: () => void
  onEdit: () => void
}

export default function ProviderDetailModal({ providerId, onClose, onEdit }: ProviderDetailModalProps) {
  const [provider, setProvider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'integrations'>('profile')

  useEffect(() => {
    fetchProvider()
  }, [providerId])

  const fetchProvider = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/providers/${providerId}`)
      const result = await response.json()

      if (result.success) {
        setProvider(result.data)
      } else {
        setError(result.error || 'Failed to load provider')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load provider')
    } finally {
      setLoading(false)
    }
  }

  const StatusBadge = ({ isActive, profileCompleted }: { isActive: boolean; profileCompleted: boolean }) => {
    if (!isActive) {
      return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-600">Archived</span>
    }
    if (!profileCompleted) {
      return <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">Onboarding</span>
    }
    return <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">Active</span>
  }

  const BooleanBadge = ({ value, label }: { value: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle className="w-4 h-4 text-green-600" />
      ) : (
        <XCircle className="w-4 h-4 text-gray-400" />
      )}
      <span className={`text-sm ${value ? 'text-green-700' : 'text-gray-500'}`}>{label}</span>
    </div>
  )

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-moonlit-brown" />
          <span>Loading provider details...</span>
        </div>
      </div>
    )
  }

  if (error || !provider) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <p className="text-red-600">{error || 'Provider not found'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-moonlit-navy text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-['Newsreader']">
              {provider.title} {provider.first_name} {provider.last_name}
            </h2>
            <p className="text-white/80 text-sm mt-1">
              {provider.role} {provider.provider_type && `• ${provider.provider_type}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center px-3 py-2 border border-white/20 rounded-md text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="px-6 flex gap-4">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-moonlit-brown text-moonlit-brown'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-moonlit-brown text-moonlit-brown'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'integrations'
                  ? 'border-moonlit-brown text-moonlit-brown'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <LinkIcon className="w-4 h-4 inline mr-2" />
              Integrations
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Status Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Status</h3>
                <div className="flex flex-wrap gap-3">
                  <StatusBadge isActive={provider.is_active} profileCompleted={provider.profile_completed} />
                  <BooleanBadge value={provider.is_bookable} label="Bookable" />
                  <BooleanBadge value={provider.list_on_provider_page} label="Listed" />
                  <BooleanBadge value={provider.accepts_new_patients} label="Accepts New Patients" />
                  <BooleanBadge value={provider.telehealth_enabled} label="Telehealth" />
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-900">{provider.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm text-gray-900">{formatPhoneNumber(provider.phone_number) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fax</p>
                    <p className="text-sm text-gray-900">{formatPhoneNumber(provider.fax_number) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm text-gray-900">{provider.address || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Professional Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">NPI</p>
                    <p className="text-sm text-gray-900">{provider.npi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm text-gray-900">{provider.role || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Provider Type</p>
                    <p className="text-sm text-gray-900">{provider.provider_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Title</p>
                    <p className="text-sm text-gray-900">{provider.title || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Education */}
              {(provider.med_school_org || provider.residency_org) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Education</h3>
                  <div className="space-y-3">
                    {provider.med_school_org && (
                      <div>
                        <p className="text-xs text-gray-500">Medical School</p>
                        <p className="text-sm text-gray-900">
                          {provider.med_school_org}
                          {provider.med_school_grad_year && ` (${provider.med_school_grad_year})`}
                        </p>
                      </div>
                    )}
                    {provider.residency_org && (
                      <div>
                        <p className="text-xs text-gray-500">Residency</p>
                        <p className="text-sm text-gray-900">{provider.residency_org}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Languages */}
              {provider.languages_spoken && provider.languages_spoken.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Languages Spoken</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.languages_spoken.map((lang: string) => (
                      <span key={lang} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* About */}
              {provider.about && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">About</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{provider.about}</p>
                </div>
              )}

              {/* What I Look For */}
              {provider.what_i_look_for_in_a_patient && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">What I Look For in a Patient</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{provider.what_i_look_for_in_a_patient}</p>
                </div>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && provider._stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-700">{provider._stats.appointmentCount}</p>
                  <p className="text-sm text-blue-600 mt-1">Appointments</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{provider._stats.contractCount}</p>
                  <p className="text-sm text-green-600 mt-1">Contracts</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-700">{provider._stats.licenseCount}</p>
                  <p className="text-sm text-purple-600 mt-1">Licenses</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm text-gray-900">
                      {provider.created_date ? new Date(provider.created_date).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Modified</p>
                    <p className="text-sm text-gray-900">
                      {provider.modified_date ? new Date(provider.modified_date).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Login</p>
                    <p className="text-sm text-gray-900">
                      {provider.last_login_at ? new Date(provider.last_login_at).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">EHR Integrations</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Athena Provider ID</p>
                    <p className="text-sm text-gray-900 font-mono">{provider.athena_provider_id || 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CAQH Provider ID</p>
                    <p className="text-sm text-gray-900 font-mono">{provider.caqh_provider_id || 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Utah ID</p>
                    <p className="text-sm text-gray-900 font-mono">{provider.utah_id || 'Not configured'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Authentication</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Auth User ID</p>
                    <p className="text-sm text-gray-900 font-mono">{provider.auth_user_id || 'Not linked'}</p>
                  </div>
                  {provider.auth_user_id && provider.auth_metadata && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Password Status</p>
                        <div className="mt-1">
                          {provider.auth_metadata.user_metadata?.temp_password === true ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              🔐 Using Temporary Password (TempPassword123!)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              ✅ Custom Password Set
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account Created</p>
                        <p className="text-sm text-gray-900">
                          {provider.auth_metadata.created_at
                            ? new Date(provider.auth_metadata.created_at).toLocaleString()
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Last Sign In</p>
                        <p className="text-sm text-gray-900">
                          {provider.auth_metadata.last_sign_in_at
                            ? new Date(provider.auth_metadata.last_sign_in_at).toLocaleString()
                            : 'Never logged in'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email Confirmed</p>
                        <div className="mt-1">
                          {provider.auth_metadata.email_confirmed ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {provider.profile_image_url && (
                    <div>
                      <p className="text-xs text-gray-500">Profile Image</p>
                      <a
                        href={provider.profile_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-moonlit-brown hover:underline"
                      >
                        View Image
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Other</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Calendar Source ID</p>
                    <p className="text-sm text-gray-900 font-mono">{provider.calendar_source_id || 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Personal Booking URL</p>
                    <p className="text-sm text-gray-900">{provider.personal_booking_url || 'Not configured'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

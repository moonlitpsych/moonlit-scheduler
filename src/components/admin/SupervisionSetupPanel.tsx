'use client'

import { useState, useEffect } from 'react'
import { Users, UserCheck, AlertCircle, ChevronDown, ChevronUp, CheckSquare, Square, X } from 'lucide-react'

interface Provider {
  id: string
  first_name: string
  last_name: string
  role: string
  provider_type: string | null
  is_active: boolean
  is_bookable: boolean
  accepts_new_patients: boolean
}

interface SupervisionMapping {
  resident_id: string
  resident_name: string
  attending_id: string
  attending_name: string
  supervision_type: string
  start_date: string
}

interface SupervisionSetupPanelProps {
  payerId: string
  effectiveDate: string | null
  allowsSupervised: boolean
  supervisionLevel: string | null
  onSupervisionChange: (mappings: SupervisionMapping[]) => void
  existingSupervision?: SupervisionMapping[]
}

export default function SupervisionSetupPanel({
  payerId,
  effectiveDate,
  allowsSupervised,
  supervisionLevel,
  onSupervisionChange,
  existingSupervision = []
}: SupervisionSetupPanelProps) {
  const [residents, setResidents] = useState<Provider[]>([])
  const [attendings, setAttendings] = useState<Provider[]>([])
  const [supervisionMappings, setSupervisionMappings] = useState<SupervisionMapping[]>(existingSupervision)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [selectAll, setSelectAll] = useState(false)
  const [defaultAttending, setDefaultAttending] = useState<string>('')
  const [showAppliedMessage, setShowAppliedMessage] = useState(false)

  // Load providers on component mount
  useEffect(() => {
    fetchProviders()
  }, [])

  // Update parent when mappings change
  useEffect(() => {
    onSupervisionChange(supervisionMappings)
  }, [supervisionMappings])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/providers', {
        credentials: 'include' // Include cookies for auth
      })
      const result = await response.json()

      if (response.ok && result.success) {
        // Map provider data from API format
        const providers: Provider[] = (result.data || []).map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          role: p.role,
          provider_type: p.provider_type || null,
          is_active: p.is_active ?? true,
          is_bookable: p.is_bookable ?? true,
          accepts_new_patients: true // API doesn't return this, assume true for admin
        }))

        // Log all providers to see what types we have
        console.log('📋 All providers:', providers.map(p => ({
          name: `${p.first_name} ${p.last_name}`,
          provider_type: p.provider_type,
          role: p.role
        })))

        // Filter residents (those who need supervision) - use provider_type field
        // Exclude test accounts (Miriam Admin, Test Practitioner)
        const residentList = providers.filter(p => {
          const isTestAccount =
            p.first_name === 'Miriam' && p.last_name === 'Admin' ||
            p.first_name === 'Test' && p.last_name === 'Practitioner'

          return p.is_active &&
            p.provider_type === 'resident physician' &&
            !isTestAccount
        })

        // Filter attendings (those who can supervise) - use provider_type field
        const attendingList = providers.filter(p => {
          return p.is_active && p.provider_type === 'attending physician'
        })

        console.log(`✅ Found ${residentList.length} residents and ${attendingList.length} attendings`)
        console.log('👨‍⚕️ Attendings:', attendingList.map(a => `${a.first_name} ${a.last_name} (${a.provider_type})`))
        console.log('👨‍🎓 Residents:', residentList.map(r => `${r.first_name} ${r.last_name} (${r.provider_type})`))

        if (attendingList.length === 0) {
          console.warn('⚠️ No attending physicians found. Please check that providers have provider_type = "attending physician"')
        }

        if (residentList.length === 0) {
          console.warn('⚠️ No resident physicians found. Please check that providers have provider_type = "resident physician"')
        }

        setResidents(residentList)
        setAttendings(attendingList)

        // Set default attending if there's only one
        if (attendingList.length === 1) {
          setDefaultAttending(attendingList[0].id)
        }

        // Initialize mappings from existing data
        if (existingSupervision.length === 0 && allowsSupervised) {
          // Auto-select all residents if this is a new setup
          const initialMappings = residentList.map(resident => ({
            resident_id: resident.id,
            resident_name: `${resident.first_name} ${resident.last_name}`,
            attending_id: defaultAttending || attendingList[0]?.id || '',
            attending_name: attendingList[0] ? `${attendingList[0].first_name} ${attendingList[0].last_name}` : '',
            supervision_type: 'general',
            start_date: effectiveDate || new Date().toISOString().split('T')[0]
          }))
          setSupervisionMappings(initialMappings)
          setSelectAll(true)
        }
      }
    } catch (error) {
      console.error('❌ Error fetching providers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResidentToggle = (resident: Provider) => {
    const residentName = `${resident.first_name} ${resident.last_name}`
    const existingIndex = supervisionMappings.findIndex(m => m.resident_id === resident.id)

    if (existingIndex >= 0) {
      // Remove from mappings
      const updated = supervisionMappings.filter(m => m.resident_id !== resident.id)
      setSupervisionMappings(updated)
    } else {
      // Add to mappings with default or selected attending
      const attending = attendings.find(a => a.id === defaultAttending) || attendings[0]
      if (attending) {
        setSupervisionMappings([...supervisionMappings, {
          resident_id: resident.id,
          resident_name: residentName,
          attending_id: attending.id,
          attending_name: `${attending.first_name} ${attending.last_name}`,
          supervision_type: 'general',
          start_date: effectiveDate || new Date().toISOString().split('T')[0]
        }])
      }
    }
  }

  const handleAttendingChange = (residentId: string, attendingId: string) => {
    const attending = attendings.find(a => a.id === attendingId)
    if (!attending) return

    setSupervisionMappings(supervisionMappings.map(mapping => {
      if (mapping.resident_id === residentId) {
        return {
          ...mapping,
          attending_id: attendingId,
          attending_name: `${attending.first_name} ${attending.last_name}`
        }
      }
      return mapping
    }))
  }

  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect all
      setSupervisionMappings([])
      setSelectAll(false)
    } else {
      // Select all with default attending
      const attending = attendings.find(a => a.id === defaultAttending) || attendings[0]
      if (!attending) {
        alert('Please select a default attending first')
        return
      }

      const allMappings = residents.map(resident => ({
        resident_id: resident.id,
        resident_name: `${resident.first_name} ${resident.last_name}`,
        attending_id: attending.id,
        attending_name: `${attending.first_name} ${attending.last_name}`,
        supervision_type: 'general',
        start_date: effectiveDate || new Date().toISOString().split('T')[0]
      }))
      setSupervisionMappings(allMappings)
      setSelectAll(true)
    }
  }

  const applyDefaultAttendingToSelected = () => {
    if (!defaultAttending) {
      alert('Please select a default attending first')
      return
    }

    const attending = attendings.find(a => a.id === defaultAttending)
    if (!attending) return

    setSupervisionMappings(supervisionMappings.map(mapping => ({
      ...mapping,
      attending_id: attending.id,
      attending_name: `${attending.first_name} ${attending.last_name}`
    })))

    // Show confirmation message
    setShowAppliedMessage(true)
    setTimeout(() => setShowAppliedMessage(false), 3000)
  }

  const isResidentSelected = (residentId: string) => {
    return supervisionMappings.some(m => m.resident_id === residentId)
  }

  const getResidentAttending = (residentId: string) => {
    return supervisionMappings.find(m => m.resident_id === residentId)?.attending_id || ''
  }

  if (!allowsSupervised) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center space-x-3 text-gray-600">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">Supervision Not Enabled</p>
            <p className="text-sm text-gray-500 mt-1">
              Enable "Allows Supervised Care" in the payer settings to configure supervision relationships.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-[#BF9C73]" />
            <div>
              <h3 className="font-semibold text-[#091747]">Supervision Setup</h3>
              <p className="text-sm text-gray-600">
                Configure which residents can book under supervising attendings
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {expanded && supervisionLevel && (
          <div className="mt-3 px-3 py-2 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Supervision Level:</strong> {supervisionLevel.replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">Bulk Actions</h4>
                  <div className="text-sm text-gray-600">
                    {supervisionMappings.length} of {residents.length} residents selected
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {selectAll ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    <span className="text-sm">{selectAll ? 'Deselect All' : 'Select All'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Default Attending:</label>
                    <select
                      value={defaultAttending}
                      onChange={(e) => setDefaultAttending(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                    >
                      <option value="">Select attending...</option>
                      {attendings.map(attending => (
                        <option key={attending.id} value={attending.id}>
                          Dr. {attending.first_name} {attending.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={applyDefaultAttendingToSelected}
                    disabled={!defaultAttending || supervisionMappings.length === 0}
                    className="px-3 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply to Selected
                  </button>

                  {/* Confirmation message */}
                  {showAppliedMessage && (
                    <div className="flex items-center space-x-2 text-green-600 text-sm animate-fade-in">
                      <CheckSquare className="h-4 w-4" />
                      <span>Applied to {supervisionMappings.length} resident(s)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Supervision Relationships */}
              {supervisionMappings.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">
                    Current Supervision Relationships ({supervisionMappings.length})
                  </h4>
                  <div className="space-y-2">
                    {supervisionMappings.map((mapping, index) => (
                      <div
                        key={`${mapping.resident_id}-${mapping.attending_id}`}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center space-x-3">
                          <UserCheck className="h-4 w-4 text-blue-600" />
                          <div>
                            <span className="font-medium text-[#091747]">{mapping.resident_name}</span>
                            <span className="text-gray-600 mx-2">→</span>
                            <span className="text-[#BF9C73]">{mapping.attending_name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Remove this relationship
                            const updated = supervisionMappings.filter((_, i) => i !== index)
                            setSupervisionMappings(updated)
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Remove supervision relationship"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Residents List */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-700 mb-2">Add Resident Assignments</h4>

                {residents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 font-medium mb-2">No active providers found</p>
                    <p className="text-sm text-gray-500">
                      No active providers were found in your database.
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Check the browser console for details about available providers.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {residents.map(resident => {
                      const isSelected = isResidentSelected(resident.id)
                      return (
                        <div
                          key={resident.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isSelected ? 'border-[#BF9C73] bg-[#BF9C73]/5' : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleResidentToggle(resident)}
                              className="p-1"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-[#BF9C73]" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                            <div>
                              <div className="font-medium text-[#091747]">
                                Dr. {resident.first_name} {resident.last_name}
                              </div>
                              <div className="text-sm text-gray-600">{resident.role}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
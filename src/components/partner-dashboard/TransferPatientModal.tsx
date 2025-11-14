/**
 * Transfer Patient Modal Component
 * Allows case managers to transfer patient ownership
 */

'use client'

import { useState, useEffect } from 'react'
import { X, UserCheck, AlertCircle } from 'lucide-react'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  active_patient_count: number
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  current_assignment?: {
    partner_user_id: string
    partner_users?: {
      full_name: string
    }
  }
}

interface TransferPatientModalProps {
  patient: Patient
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TransferPatientModal({
  patient,
  isOpen,
  onClose,
  onSuccess
}: TransferPatientModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/partner-dashboard/team')

      if (!response.ok) {
        console.error('Team API returned error:', response.status)
        setError(`Failed to load team members (${response.status})`)
        return
      }

      const data = await response.json()

      if (data.success) {
        // Filter out the currently assigned user
        const availableMembers = data.data.team_members.filter(
          (member: TeamMember) => member.id !== patient.current_assignment?.partner_user_id
        )
        setTeamMembers(availableMembers)
      } else {
        setError(data.error || 'Failed to load team members')
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
      setError('Failed to load team members')
    }
  }

  const handleTransfer = async () => {
    if (!selectedUserId) {
      setError('Please select a team member')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/partner-dashboard/patients/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          from_user_id: patient.current_assignment?.partner_user_id || null,
          to_user_id: selectedUserId,
          notes: notes || null
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Transfer API error:', response.status, errorText)
        setError(`Transfer failed (${response.status})`)
        setLoading(false)
        return
      }

      const data = await response.json()

      if (data.success) {
        onSuccess()
        onClose()
        setSelectedUserId('')
        setNotes('')
      } else {
        setError(data.error || 'Failed to transfer patient')
      }
    } catch (err: any) {
      console.error('Error transferring patient:', err)
      setError('Failed to transfer patient')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currentAssignee = patient.current_assignment?.partner_users?.full_name || 'Unassigned'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-['Newsreader']">
                Transfer Patient
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {patient.first_name} {patient.last_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Assignment */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Case management currently assigned to</p>
            <p className="text-sm font-medium text-gray-900">{currentAssignee}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Team Member Select */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer to
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Select a team member...</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({member.active_patient_count} patients)
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={loading}
            />
          </div>

          {/* Case Manager Responsibility Note */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-medium">Note:</span> The assigned case manager will receive all updates, appointments, and forms for this patient.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || !selectedUserId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Transferring...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Transfer Patient</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { X, Save, DollarSign, FileText, User, Calendar } from 'lucide-react'

interface AppointmentDetailDrawerProps {
  appointmentId: string
  onClose: () => void
  onUpdate: () => void
}

interface AppointmentDetail {
  appointment_id: string
  appt_date: string
  service: string
  practitioner: string
  last_name: string
  payer: string | null
  rev_type: string
  expected_gross_cents: number
  provider_expected_pay_cents: number
  provider_expected_calc_source: any
  provider_actual_pay_cents: number
  provider_actual_calc_source: any
  provider_paid_cents: number | null
  provider_pay_status: string
  claim_status: string
  reimbursement_cents: number | null
  patient_paid: number | null
  patient_paid_date: string | null
  discount_note: string | null
  appointment_status: string | null
  notes_override: string | null
}

export default function AppointmentDetailDrawer({
  appointmentId,
  onClose,
  onUpdate
}: AppointmentDetailDrawerProps) {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AppointmentDetail | null>(null)
  const [editing, setEditing] = useState(false)

  // Editable fields
  const [patientPaid, setPatientPaid] = useState('')
  const [patientPaidDate, setPatientPaidDate] = useState('')
  const [providerPaid, setProviderPaid] = useState('')
  const [providerPaidDate, setProviderPaidDate] = useState('')
  const [discountNote, setDiscountNote] = useState('')
  const [claimStatus, setClaimStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [reimbursementAmount, setReimbursementAmount] = useState('')
  const [isTestData, setIsTestData] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [appointmentId])

  const fetchDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/finance/appointments?appointment_id=${appointmentId}&limit=1`)
      const result = await response.json()

      if (result.success && result.data && result.data.length > 0) {
        const appt = result.data[0]
        setDetail(appt)
        setPatientPaid(appt.patient_paid?.toString() || '')
        setPatientPaidDate(appt.patient_paid_date || '')
        setProviderPaid(appt.provider_paid_cents ? (appt.provider_paid_cents / 100).toFixed(2) : '')
        setProviderPaidDate(appt.provider_paid_date || '')
        setDiscountNote(appt.discount_note || '')
        setClaimStatus(appt.claim_status || '')
        setNotes(appt.notes_override || '')
        setReimbursementAmount(appt.reimbursement_cents ? (appt.reimbursement_cents / 100).toFixed(2) : '')
        setIsTestData(appt.is_test_data || false)
      }
    } catch (error: any) {
      console.error('Failed to load appointment detail:', error)
      alert('Failed to load details')
    } finally {
      setLoading(false)
    }
  }

  const saveOverride = async (columnName: string, value: any) => {
    try {
      const response = await fetch(`/api/finance/appointments/${appointmentId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: columnName,
          value,
          reason: `Manual override via UI by admin at ${new Date().toISOString()}`,
          changed_by: null, // TODO: Get from auth context
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error)
      }

      return true
    } catch (error: any) {
      alert(`Failed to save ${columnName}: ` + error.message)
      return false
    }
  }

  const handleSaveAll = async () => {
    const updates = [
      { column: 'patient_paid', value: patientPaid ? parseFloat(patientPaid) : null },
      { column: 'patient_paid_date', value: patientPaidDate || null },
      { column: 'provider_paid_cents', value: providerPaid ? Math.round(parseFloat(providerPaid) * 100) : null },
      { column: 'provider_paid_date', value: providerPaidDate || null },
      { column: 'discount_reason', value: discountNote || null },
      { column: 'claim_status', value: claimStatus || null },
      { column: 'notes', value: notes || null },
      { column: 'reimbursement_cents', value: reimbursementAmount ? Math.round(parseFloat(reimbursementAmount) * 100) : null },
      { column: 'is_test_data', value: isTestData },
    ]

    let allSuccess = true
    for (const update of updates) {
      const success = await saveOverride(update.column, update.value)
      if (!success) allSuccess = false
    }

    if (allSuccess) {
      alert('All changes saved')
      setEditing(false)
      onUpdate()
      fetchDetail()
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 flex items-center justify-center">
        <div className="text-[#091747]/60">Loading...</div>
      </div>
    )
  }

  if (!detail) {
    return null
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-stone-200">
        <div>
          <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
            Appointment Details
          </h2>
          <p className="text-sm text-[#091747]/60">{detail.appt_date}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-[#091747]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Core Info */}
        <section>
          <h3 className="text-sm font-medium text-[#091747]/60 uppercase mb-3">Core Information</h3>
          <div className="space-y-2">
            <InfoRow label="Practitioner" value={detail.practitioner} icon={<User className="h-4 w-4" />} />
            <InfoRow label="Service" value={detail.service} icon={<FileText className="h-4 w-4" />} />
            <InfoRow label="Patient" value={detail.last_name} />
            <InfoRow label="Payer" value={detail.payer || 'Cash'} />
            <InfoRow label="Revenue Type" value={detail.rev_type} />
          </div>
        </section>

        {/* Financial Summary */}
        <section>
          <h3 className="text-sm font-medium text-[#091747]/60 uppercase mb-3">Financial Summary</h3>
          <div className="space-y-2">
            <InfoRow
              label="Expected Gross"
              value={`$${(detail.expected_gross_cents / 100).toFixed(2)}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <InfoRow
              label="Provider Expected Pay"
              value={`$${(detail.provider_expected_pay_cents / 100).toFixed(2)}`}
            />
            <InfoRow
              label="Provider Actual Pay"
              value={`$${(detail.provider_actual_pay_cents / 100).toFixed(2)}`}
            />
            <InfoRow
              label="Provider Pay Status"
              value={detail.provider_pay_status}
              badge
            />
            <InfoRow
              label="Reimbursement"
              value={detail.reimbursement_cents ? `$${(detail.reimbursement_cents / 100).toFixed(2)}` : 'Pending'}
            />
          </div>
        </section>

        {/* Calculation Provenance */}
        {detail.provider_expected_calc_source && (
          <section>
            <h3 className="text-sm font-medium text-[#091747]/60 uppercase mb-3">Calculation Details (Expected)</h3>
            <div className="bg-stone-50 p-4 rounded-lg">
              <pre className="text-xs text-[#091747] font-mono overflow-x-auto">
                {JSON.stringify(detail.provider_expected_calc_source, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* Editable Overrides */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#091747]/60 uppercase">Manual Overrides</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-[#BF9C73] hover:text-[#BF9C73]/80"
              >
                Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Patient Paid ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={patientPaid}
                onChange={(e) => setPatientPaid(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Patient Paid Date
              </label>
              <input
                type="date"
                value={patientPaidDate}
                onChange={(e) => setPatientPaidDate(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Discount Note
              </label>
              <input
                type="text"
                value={discountNote}
                onChange={(e) => setDiscountNote(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Reimbursement Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={reimbursementAmount}
                onChange={(e) => setReimbursementAmount(e.target.value)}
                disabled={!editing}
                placeholder="Enter insurance reimbursement amount"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
              <p className="mt-1 text-xs text-[#091747]/50">
                Enter the actual amount received from insurance
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Provider Paid Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={providerPaid}
                onChange={(e) => setProviderPaid(e.target.value)}
                disabled={!editing}
                placeholder="Amount paid to provider"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
              <p className="mt-1 text-xs text-[#091747]/50">
                Amount paid to provider for this appointment
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Provider Paid Date
              </label>
              <input
                type="date"
                value={providerPaidDate}
                onChange={(e) => setProviderPaidDate(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Claim Status Override
              </label>
              <select
                value={claimStatus}
                onChange={(e) => setClaimStatus(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              >
                <option value="">-- Default --</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="denied">Denied</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="not_needed">Not Needed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#091747] mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!editing}
                rows={3}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 disabled:bg-stone-50"
              />
            </div>

            <div className="flex items-center space-x-2 pt-3 border-t border-stone-200">
              <input
                type="checkbox"
                id="isTestData"
                checked={isTestData}
                onChange={(e) => setIsTestData(e.target.checked)}
                disabled={!editing}
                className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-stone-300 rounded disabled:opacity-50"
              />
              <label htmlFor="isTestData" className="text-sm font-medium text-[#091747]">
                Mark as Test Data
              </label>
              <span className="text-xs text-[#091747]/50 ml-2">
                (Test data will be excluded from reports)
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      {editing && (
        <div className="p-6 border-t border-stone-200 flex items-center justify-end space-x-3">
          <button
            onClick={() => {
              setEditing(false)
              fetchDetail() // Reset changes
            }}
            className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save All Changes</span>
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({
  label,
  value,
  icon,
  badge
}: {
  label: string
  value: string
  icon?: React.ReactNode
  badge?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-2 text-sm text-[#091747]/60">
        {icon}
        <span>{label}</span>
      </div>
      {badge ? (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
          {value}
        </span>
      ) : (
        <span className="text-sm font-medium text-[#091747]">{value}</span>
      )}
    </div>
  )
}

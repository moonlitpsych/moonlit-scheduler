'use client'

import { useState, useEffect } from 'react'
import { Search, Upload, Download, RefreshCw, DollarSign, TrendingUp } from 'lucide-react'
import AppointmentDetailDrawer from '@/components/finance/AppointmentDetailDrawer'
import FileUploadModal from '@/components/finance/FileUploadModal'
import ProviderPaySummary from '@/components/finance/ProviderPaySummary'

interface AppointmentGridRow {
  appointment_id: string
  appt_date: string
  service: string
  practitioner: string
  last_name: string
  payer: string | null
  rev_type: string
  expected_gross_cents: number
  provider_expected_pay_cents: number
  provider_paid_cents: number | null
  provider_pay_status: string
  provider_paid_date: string | null
  claim_status: string
  reimbursement_cents: number | null
  expected_net_cents: number
  actual_net_cents: number
  patient_paid: number | null
  patient_paid_date: string | null
  discount_note: string | null
  appointment_status: string | null
  is_test_data: boolean
}

export default function FinanceAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentGridRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadType, setUploadType] = useState<'appointments' | 'era' | 'provider-pay'>('appointments')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showTestData, setShowTestData] = useState(false)

  // Date filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchAppointments = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (fromDate) params.append('from', fromDate)
      if (toDate) params.append('to', toDate)
      params.append('limit', '100')

      const response = await fetch(`/api/finance/appointments?${params}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch appointments')
      }

      setAppointments(result.data || [])
    } catch (error: any) {
      console.error('Error fetching appointments:', error)
      alert('Failed to load appointments: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [fromDate, toDate])

  const handleRecompute = async () => {
    if (!fromDate || !toDate) {
      alert('Please select date range first')
      return
    }

    if (!confirm(`Recompute provider earnings for ${fromDate} to ${toDate}?`)) {
      return
    }

    try {
      const response = await fetch('/api/finance/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromDate, to: toDate })
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        fetchAppointments() // Refresh data
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      alert('Recompute failed: ' + error.message)
    }
  }

  const exportToCSV = () => {
    if (appointments.length === 0) {
      alert('No data to export')
      return
    }

    const headers = [
      'Date', 'Service', 'Practitioner', 'Patient', 'Payer', 'Rev Type',
      'Expected Gross', 'Provider Expected Pay', 'Provider Paid', 'Provider Paid Date', 'Provider Pay Status',
      'Claim Status', 'Reimbursement', 'Patient Paid', 'Patient Paid Date', 'Expected Net', 'Actual Net', 'Discount Note'
    ]

    const rows = appointments.map(a => [
      a.appt_date,
      a.service,
      a.practitioner,
      a.last_name,
      a.payer || 'Cash',
      a.rev_type,
      (a.expected_gross_cents / 100).toFixed(2),
      (a.provider_expected_pay_cents / 100).toFixed(2),
      a.provider_paid_cents ? (a.provider_paid_cents / 100).toFixed(2) : '',
      a.provider_paid_date || '',
      a.provider_pay_status,
      a.claim_status,
      a.reimbursement_cents ? (a.reimbursement_cents / 100).toFixed(2) : '',
      a.patient_paid ? (a.patient_paid / 100).toFixed(2) : '',
      a.patient_paid_date || '',
      (a.expected_net_cents / 100).toFixed(2),
      (a.actual_net_cents / 100).toFixed(2),
      a.discount_note || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments_${fromDate || 'all'}_${toDate || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalRevenue = appointments.reduce((sum, a) => sum + (a.reimbursement_cents || 0), 0)
  const totalExpectedGross = appointments.reduce((sum, a) => sum + a.expected_gross_cents, 0)
  const totalProviderPay = appointments.reduce((sum, a) => sum + (a.provider_paid_cents || 0), 0)
  const totalActualNet = appointments.reduce((sum, a) => sum + a.actual_net_cents, 0)

  const handleBulkMarkTestData = async (isTest: boolean) => {
    if (selectedRows.size === 0) {
      alert('No appointments selected')
      return
    }

    if (!confirm(`Mark ${selectedRows.size} appointments as ${isTest ? 'TEST DATA' : 'REAL DATA'}?`)) {
      return
    }

    try {
      const promises = Array.from(selectedRows).map(appointmentId =>
        fetch(`/api/finance/appointments/${appointmentId}/override`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            column_name: 'is_test_data',
            value: isTest,
            reason: `Bulk mark as ${isTest ? 'test' : 'real'} data by admin`,
            changed_by: null
          })
        })
      )

      await Promise.all(promises)
      alert(`${selectedRows.size} appointments updated`)
      setSelectedRows(new Set())
      fetchAppointments()
    } catch (error: any) {
      alert('Bulk update failed: ' + error.message)
    }
  }

  const toggleRowSelection = (appointmentId: string) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(appointmentId)) {
      newSelection.delete(appointmentId)
    } else {
      newSelection.add(appointmentId)
    }
    setSelectedRows(newSelection)
  }

  const filteredAppointments = appointments.filter(a => {
    // Test data filter
    if (!showTestData && a.is_test_data) {
      return false
    }

    // Search filter
    if (searchTerm === '') return true
    return (
      a.practitioner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.payer?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Finance — Appointments
        </h1>
        <p className="text-[#091747]/70">
          Manage appointments, track revenue, and calculate provider compensation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            ${(totalRevenue / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Total Revenue</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            ${(totalExpectedGross / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Expected Gross</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            ${(totalProviderPay / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Provider Pay</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-stone-200">
          <div className="text-2xl font-bold text-[#091747]">
            ${(totalActualNet / 100).toLocaleString()}
          </div>
          <div className="text-sm text-[#091747]/60">Net (Actual)</div>
        </div>
      </div>

      {/* Provider Pay Summary */}
      <div className="mb-6">
        <ProviderPaySummary onRefresh={fetchAppointments} />
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* Date Filters and Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-[#091747]/70 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#091747]/70 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
              />
            </div>
            <button
              onClick={fetchAppointments}
              className="mt-6 px-4 py-2 bg-[#091747] hover:bg-[#091747]/90 text-white rounded-lg transition-colors"
            >
              Apply Filter
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setUploadType('appointments')
                setUploadModalOpen(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Appointments</span>
            </button>
            <button
              onClick={() => {
                setUploadType('era')
                setUploadModalOpen(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>Upload ERA</span>
            </button>
            <button
              onClick={() => {
                setUploadType('provider-pay')
                setUploadModalOpen(true)
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
              title="Upload provider pay data from your spreadsheet"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Provider Pay</span>
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center space-x-2 px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleRecompute}
              className="flex items-center space-x-2 px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
              title="Recompute provider earnings for date range"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Recompute</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex-1 max-w-md space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#091747]/40" />
            <input
              type="text"
              placeholder="Search by practitioner, patient, or payer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTestData}
                onChange={(e) => setShowTestData(e.target.checked)}
                className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-stone-300 rounded"
              />
              <span className="text-sm text-[#091747]">Show test data</span>
            </label>
            {selectedRows.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-[#091747]">{selectedRows.size} selected</span>
                <button
                  onClick={() => handleBulkMarkTestData(true)}
                  className="px-3 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors"
                >
                  Mark as Test
                </button>
                <button
                  onClick={() => handleBulkMarkTestData(false)}
                  className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                >
                  Mark as Real
                </button>
                <button
                  onClick={() => setSelectedRows(new Set())}
                  className="px-3 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-[#091747] rounded transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#091747]/60">Loading...</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center text-[#091747]/60">No appointments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 w-12"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Practitioner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Payer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#091747]/60 uppercase">Rev Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">Expected Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">Provider Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#091747]/60 uppercase">Pay Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#091747]/60 uppercase">Claim Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">Reimbursement</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#091747]/60 uppercase">Actual Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredAppointments.map((appt) => (
                  <tr
                    key={appt.appointment_id}
                    className={`hover:bg-stone-50 transition-colors ${appt.is_test_data ? 'bg-orange-50/50' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(appt.appointment_id)}
                        onChange={() => toggleRowSelection(appt.appointment_id)}
                        className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-stone-300 rounded"
                      />
                    </td>
                    <td
                      className="px-4 py-3 text-sm text-[#091747] cursor-pointer"
                      onClick={() => setSelectedAppointment(appt.appointment_id)}
                    >
                      {appt.appt_date}
                      {appt.is_test_data && <span className="ml-1 text-xs text-orange-600">TEST</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] cursor-pointer" onClick={() => setSelectedAppointment(appt.appointment_id)}>{appt.service}</td>
                    <td className="px-4 py-3 text-sm text-[#091747]">{appt.practitioner}</td>
                    <td className="px-4 py-3 text-sm text-[#091747]">{appt.last_name}</td>
                    <td className="px-4 py-3 text-sm text-[#091747]">{appt.payer || 'Cash'}</td>
                    <td className="px-4 py-3 text-sm text-[#091747]">{appt.rev_type}</td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right">
                      ${(appt.expected_gross_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right">
                      ${(appt.provider_expected_pay_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appt.provider_pay_status === 'PAID' ? 'bg-green-100 text-green-800' :
                        appt.provider_pay_status === 'READY' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {appt.provider_pay_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                        {appt.claim_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right">
                      {appt.reimbursement_cents ? `$${(appt.reimbursement_cents / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#091747] text-right font-medium">
                      ${(appt.actual_net_cents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedAppointment && (
        <AppointmentDetailDrawer
          appointmentId={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={fetchAppointments}
        />
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <FileUploadModal
          type={uploadType}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            setUploadModalOpen(false)
            fetchAppointments()
          }}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Search, Upload, Download, RefreshCw, DollarSign, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react'
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
  actual_gross_cents: number
  provider_expected_pay_cents: number
  provider_paid_cents: number | null
  provider_pay_status: string
  provider_paid_date: string | null
  claim_status: string
  reimbursement_cents: number | null
  copay_cents: number | null
  copay_date: string | null
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

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Advanced filters
  const [serviceFilter, setServiceFilter] = useState('')
  const [claimStatusFilter, setClaimStatusFilter] = useState('')
  const [payStatusFilter, setPayStatusFilter] = useState('')
  const [revTypeFilter, setRevTypeFilter] = useState('')

  // Column configuration
  const defaultColumns = [
    { id: 'date', label: 'Date', align: 'left' },
    { id: 'service', label: 'Service', align: 'left' },
    { id: 'practitioner', label: 'Practitioner', align: 'left' },
    { id: 'patient', label: 'Patient', align: 'left' },
    { id: 'payer', label: 'Payer', align: 'left' },
    { id: 'rev_type', label: 'Rev Type', align: 'left' },
    { id: 'expected_gross', label: 'Expected Gross', align: 'right' },
    { id: 'actual_gross', label: 'Actual Gross', align: 'right' },
    { id: 'provider_pay', label: 'Provider Pay (Expected)', align: 'right' },
    { id: 'provider_paid_amt', label: 'Provider Paid (Actual)', align: 'right' },
    { id: 'provider_paid_date', label: 'Provider Paid Date', align: 'center' },
    { id: 'pay_status', label: 'Pay Status', align: 'center' },
    { id: 'claim_status', label: 'Claim Status', align: 'center' },
    { id: 'reimbursement', label: 'Reimbursement', align: 'right' },
    { id: 'copay', label: 'Copay', align: 'right' },
    { id: 'expected_net', label: 'Expected Net', align: 'right' },
    { id: 'actual_net', label: 'Actual Net', align: 'right' }
  ]

  // Column order state (load from localStorage)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('financeAppointmentsColumnOrder')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          return defaultColumns.map(c => c.id)
        }
      }
    }
    return defaultColumns.map(c => c.id)
  })

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('financeAppointmentsVisibleColumns')
      if (saved) {
        try {
          return new Set(JSON.parse(saved))
        } catch (e) {
          return new Set(defaultColumns.map(c => c.id))
        }
      }
    }
    return new Set(defaultColumns.map(c => c.id))
  })

  const [columnMenuOpen, setColumnMenuOpen] = useState(false)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{appointmentId: string, field: string} | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const fetchAppointments = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (fromDate) params.append('from', fromDate)
      if (toDate) params.append('to', toDate)
      if (sortColumn) params.append('sort_by', sortColumn)
      if (sortDirection) params.append('sort_order', sortDirection)
      if (serviceFilter) params.append('service', serviceFilter)
      if (claimStatusFilter) params.append('claim_status', claimStatusFilter)
      if (payStatusFilter) params.append('pay_status', payStatusFilter)
      if (revTypeFilter) params.append('rev_type', revTypeFilter)
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
  }, [searchTerm, fromDate, toDate, sortColumn, sortDirection, serviceFilter, claimStatusFilter, payStatusFilter, revTypeFilter])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to descending
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />
  }

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()

    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    const newOrder = [...columnOrder]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumnId)

    // Remove from old position
    newOrder.splice(draggedIndex, 1)
    // Insert at new position
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    localStorage.setItem('financeAppointmentsColumnOrder', JSON.stringify(newOrder))
    setDraggedColumn(null)
  }

  const resetColumnOrder = () => {
    const defaultOrder = defaultColumns.map(c => c.id)
    setColumnOrder(defaultOrder)
    localStorage.setItem('financeAppointmentsColumnOrder', JSON.stringify(defaultOrder))
  }

  const getColumnConfig = (columnId: string) => {
    return defaultColumns.find(c => c.id === columnId) || defaultColumns[0]
  }

  const toggleColumnVisibility = (columnId: string) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId)
    } else {
      newVisible.add(columnId)
    }
    setVisibleColumns(newVisible)
    localStorage.setItem('financeAppointmentsVisibleColumns', JSON.stringify(Array.from(newVisible)))
  }

  const getVisibleColumns = () => {
    return columnOrder.filter(colId => visibleColumns.has(colId))
  }

  const saveInlineEdit = async (appointmentId: string, field: string, value: any) => {
    try {
      setSaving(true)

      // Map frontend field names to database column names
      const fieldMapping: Record<string, string> = {
        'provider_paid_amt': 'provider_paid_cents',
        'provider_paid_date': 'provider_paid_date',
        'claim_status': 'claim_status',
        'reimbursement': 'reimbursement_cents',
        'copay': 'copay_cents'
      }

      const dbColumn = fieldMapping[field] || field

      // Convert dollars to cents for money fields
      let dbValue = value
      if (field === 'provider_paid_amt' || field === 'reimbursement' || field === 'copay') {
        dbValue = value ? Math.round(parseFloat(value) * 100) : null
      }

      // OPTIMISTIC UPDATE: Update local state immediately
      setAppointments(prev => prev.map(a =>
        a.appointment_id === appointmentId
          ? { ...a, [dbColumn]: dbValue }
          : a
      ))
      setEditingCell(null)

      // Save to backend
      const response = await fetch(`/api/finance/appointments/${appointmentId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: dbColumn,
          value: dbValue,
          reason: `Inline edit via finance table at ${new Date().toISOString()}`,
          changed_by: null
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error)
      }

      // Success - no need to refetch, optimistic update already applied
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
      // Refetch only on error to restore correct state
      fetchAppointments()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (appointmentId: string, field: string, currentValue: any) => {
    setEditingCell({ appointmentId, field })
    // Format the value for editing
    if (field === 'provider_paid_amt' || field === 'reimbursement') {
      // Convert cents to dollars
      setEditValue(currentValue ? (currentValue / 100).toFixed(2) : '')
    } else {
      setEditValue(currentValue || '')
    }
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, appointmentId: string, field: string) => {
    if (e.key === 'Enter') {
      saveInlineEdit(appointmentId, field, editValue)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  const renderCellContent = (columnId: string, appt: AppointmentGridRow) => {
    const isEditing = editingCell?.appointmentId === appt.appointment_id && editingCell?.field === columnId

    switch (columnId) {
      case 'date':
        return (
          <>
            {appt.appt_date}
            {appt.is_test_data && <span className="ml-1 text-xs text-orange-600">TEST</span>}
          </>
        )
      case 'service':
        return appt.service
      case 'practitioner':
        return appt.practitioner
      case 'patient':
        return appt.last_name
      case 'payer':
        return appt.payer || 'Cash'
      case 'rev_type':
        return appt.rev_type
      case 'expected_gross':
        return `$${(appt.expected_gross_cents / 100).toFixed(2)}`
      case 'actual_gross': {
        const hasActual = appt.actual_gross_cents > 0
        const hasExpected = appt.expected_gross_cents > 0
        const shouldCompare = hasActual && hasExpected
        const isGood = shouldCompare && appt.actual_gross_cents >= appt.expected_gross_cents
        const isBad = shouldCompare && appt.actual_gross_cents < appt.expected_gross_cents

        return (
          <span className={
            isGood ? 'text-green-700 font-semibold' :
            isBad ? 'text-rose-600 font-semibold' :
            ''
          }>
            ${(appt.actual_gross_cents / 100).toFixed(2)}
          </span>
        )
      }
      case 'provider_pay':
        return `$${(appt.provider_expected_pay_cents / 100).toFixed(2)}`

      // EDITABLE FIELD: Provider Paid Amount (Column K)
      case 'provider_paid_amt':
        if (isEditing) {
          return (
            <input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveInlineEdit(appt.appointment_id, columnId, editValue)}
              onKeyDown={(e) => handleEditKeyDown(e, appt.appointment_id, columnId)}
              autoFocus
              disabled={saving}
              className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return (
          <span
            className="cursor-pointer text-blue-600 hover:underline"
            onClick={() => startEdit(appt.appointment_id, columnId, appt.provider_paid_cents)}
            title="Click to edit"
          >
            {appt.provider_paid_cents ? `$${(appt.provider_paid_cents / 100).toFixed(2)}` : '$0.00'}
          </span>
        )

      // EDITABLE FIELD: Provider Paid Date (Column O)
      case 'provider_paid_date':
        if (isEditing) {
          return (
            <input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveInlineEdit(appt.appointment_id, columnId, editValue)}
              onKeyDown={(e) => handleEditKeyDown(e, appt.appointment_id, columnId)}
              autoFocus
              disabled={saving}
              className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return (
          <span
            className="cursor-pointer text-blue-600 hover:underline"
            onClick={() => startEdit(appt.appointment_id, columnId, appt.provider_paid_date)}
            title="Click to edit"
          >
            {appt.provider_paid_date || '-'}
          </span>
        )

      case 'pay_status':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            appt.provider_pay_status === 'PAID' ? 'bg-green-100 text-green-800' :
            appt.provider_pay_status === 'REIMBURSED_UNPAID' ? 'bg-amber-100 text-amber-800' :
            appt.provider_pay_status === 'READY' ? 'bg-blue-100 text-blue-800' :
            appt.provider_pay_status === 'NO COMPENSATION' ? 'bg-gray-100 text-gray-500' :
            'bg-gray-100 text-gray-800'
          }`}>
            {appt.provider_pay_status}
          </span>
        )

      // EDITABLE FIELD: Claim Status (Column T) - Dropdown
      case 'claim_status':
        if (isEditing) {
          return (
            <select
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value)
                saveInlineEdit(appt.appointment_id, columnId, e.target.value)
              }}
              onBlur={cancelEdit}
              autoFocus
              disabled={saving}
              className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="not_needed">not needed</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="accepted">Accepted</option>
              <option value="denied">Denied</option>
              <option value="paid">PAID</option>
              <option value="resubmitted">Resubmitted</option>
            </select>
          )
        }
        const statusColors: Record<string, string> = {
          'paid': 'bg-green-100 text-green-800',
          'PAID': 'bg-green-100 text-green-800',
          'resubmitted': 'bg-purple-100 text-purple-800',
          'Resubmitted': 'bg-purple-100 text-purple-800',
          'submitted': 'bg-blue-100 text-blue-800',
          'Submitted': 'bg-blue-100 text-blue-800',
          'denied': 'bg-red-100 text-red-800',
          'Denied': 'bg-red-100 text-red-800',
          'not_needed': 'bg-gray-100 text-gray-800',
          'pending': 'bg-yellow-100 text-yellow-800'
        }
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${statusColors[appt.claim_status] || 'bg-stone-100 text-stone-800'}`}
            onClick={() => startEdit(appt.appointment_id, columnId, appt.claim_status)}
            title="Click to edit"
          >
            {appt.claim_status}
          </span>
        )

      // EDITABLE FIELD: Reimbursement Amount (Column U)
      case 'reimbursement':
        if (isEditing) {
          return (
            <input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveInlineEdit(appt.appointment_id, columnId, editValue)}
              onKeyDown={(e) => handleEditKeyDown(e, appt.appointment_id, columnId)}
              autoFocus
              disabled={saving}
              className="w-full px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return (
          <span
            className="cursor-pointer text-blue-600 hover:underline"
            onClick={() => startEdit(appt.appointment_id, columnId, appt.reimbursement_cents)}
            title="Click to edit"
          >
            {appt.reimbursement_cents ? `$${(appt.reimbursement_cents / 100).toFixed(2)}` : '$0.00'}
          </span>
        )

      case 'copay':
        if (isEditing) {
          return (
            <input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveInlineEdit(appt.appointment_id, columnId, editValue)}
              onKeyDown={(e) => handleEditKeyDown(e, appt.appointment_id, columnId)}
              autoFocus
              className="w-full px-2 py-1 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-[#b47e4f]"
            />
          )
        }
        return appt.copay_cents ? `$${(appt.copay_cents / 100).toFixed(2)}` : '-'
      case 'expected_net':
        return `$${(appt.expected_net_cents / 100).toFixed(2)}`
      case 'actual_net': {
        const hasActual = appt.actual_net_cents > 0
        const hasExpected = appt.expected_net_cents > 0
        const shouldCompare = hasActual && hasExpected
        const isGood = shouldCompare && appt.actual_net_cents >= appt.expected_net_cents
        const isBad = shouldCompare && appt.actual_net_cents < appt.expected_net_cents

        return (
          <span className={
            isGood ? 'text-green-700 font-semibold' :
            isBad ? 'text-rose-600 font-semibold' :
            ''
          }>
            ${(appt.actual_net_cents / 100).toFixed(2)}
          </span>
        )
      }
      default:
        return ''
    }
  }

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
    // Test data filter (search is handled server-side now)
    if (!showTestData && a.is_test_data) {
      return false
    }

    return true
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
          <div className="flex items-center space-x-4 flex-wrap">
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
            <div className="relative">
              <button
                onClick={() => setColumnMenuOpen(!columnMenuOpen)}
                className="flex items-center space-x-2 px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
                title="Show/hide columns"
              >
                <Eye className="h-4 w-4" />
                <span>Columns</span>
              </button>

              {columnMenuOpen && (
                <>
                  {/* Backdrop to close menu when clicking outside */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setColumnMenuOpen(false)}
                  ></div>

                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-stone-200 py-2 z-20">
                    <div className="px-3 py-2 text-xs font-medium text-[#091747]/60 uppercase border-b border-stone-200 mb-2">
                      Show/Hide Columns
                    </div>
                    {defaultColumns.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center px-3 py-2 hover:bg-stone-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col.id)}
                          onChange={() => toggleColumnVisibility(col.id)}
                          className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-stone-300 rounded"
                        />
                        <span className="ml-2 text-sm text-[#091747]">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={resetColumnOrder}
              className="flex items-center space-x-2 px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
              title="Reset column order to default"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reset Columns</span>
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
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#091747]/40" />
            <input
              type="text"
              placeholder="Search by practitioner, patient, or payer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
          </div>

          {/* Advanced Filters Row */}
          <div className="flex items-center space-x-3 flex-wrap">
            <div>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 text-sm"
              >
                <option value="">All Services</option>
                <option value="Intake">Intake</option>
                <option value="Follow-up (Short)">Follow-up (Short)</option>
                <option value="Follow-up (Extended)">Follow-up (Extended)</option>
              </select>
            </div>

            <div>
              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 text-sm"
              >
                <option value="">All Claim Statuses</option>
                <option value="not_needed">Not Needed</option>
                <option value="not started">Not Started</option>
                <option value="submitted">Submitted</option>
                <option value="resubmitted">Resubmitted</option>
                <option value="accepted">Accepted</option>
                <option value="needs more info from pt">Needs More Info from Pt</option>
                <option value="denied - needs atten.">Denied - Needs Attention</option>
                <option value="perm. denied">Permanently Denied</option>
                <option value="paid">Paid</option>
                <option value="check issued; not deposited">Check Issued; Not Deposited</option>
              </select>
            </div>

            <div>
              <select
                value={payStatusFilter}
                onChange={(e) => setPayStatusFilter(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 text-sm"
              >
                <option value="">All Pay Statuses</option>
                <option value="NO COMPENSATION">No Compensation</option>
                <option value="PENDING">Pending</option>
                <option value="REIMBURSED_UNPAID">Reimbursed (Unpaid)</option>
                <option value="READY">Ready</option>
                <option value="PAID">Paid</option>
              </select>
            </div>

            <div>
              <select
                value={revTypeFilter}
                onChange={(e) => setRevTypeFilter(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 text-sm"
              >
                <option value="">All Revenue Types</option>
                <option value="Cash">Cash</option>
                <option value="Medicaid">Medicaid</option>
                <option value="Private">Private</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(serviceFilter || claimStatusFilter || payStatusFilter || revTypeFilter) && (
              <button
                onClick={() => {
                  setServiceFilter('')
                  setClaimStatusFilter('')
                  setPayStatusFilter('')
                  setRevTypeFilter('')
                }}
                className="px-3 py-2 text-xs bg-stone-100 hover:bg-stone-200 text-[#091747] rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
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
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-12"></th>
                  {getVisibleColumns().map((columnId) => {
                    const config = getColumnConfig(columnId)
                    const alignClass = config.align === 'right' ? 'justify-end' : config.align === 'center' ? 'justify-center' : 'justify-start'
                    const textAlign = config.align === 'right' ? 'text-right' : config.align === 'center' ? 'text-center' : 'text-left'

                    return (
                      <th
                        key={columnId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, columnId)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, columnId)}
                        className={`px-4 py-3 ${textAlign} text-xs font-medium text-[#091747]/60 uppercase cursor-move hover:bg-stone-100 transition-colors ${draggedColumn === columnId ? 'opacity-50' : ''}`}
                        onClick={() => handleSort(columnId)}
                        title="Click to sort, drag to reorder"
                      >
                        <div className={`flex items-center space-x-1 ${alignClass}`}>
                          <span>{config.label}</span>
                          {getSortIcon(columnId)}
                        </div>
                      </th>
                    )
                  })}
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
                    {getVisibleColumns().map((columnId) => {
                      const config = getColumnConfig(columnId)
                      const textAlign = config.align === 'right' ? 'text-right' : config.align === 'center' ? 'text-center' : 'text-left'
                      const isCursorPointer = ['date', 'service'].includes(columnId)

                      return (
                        <td
                          key={columnId}
                          className={`px-4 py-3 text-sm text-[#091747] ${textAlign} ${isCursorPointer ? 'cursor-pointer' : ''} ${config.align === 'right' ? 'font-medium' : ''}`}
                          onClick={() => isCursorPointer && setSelectedAppointment(appt.appointment_id)}
                        >
                          {renderCellContent(columnId, appt)}
                        </td>
                      )
                    })}
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

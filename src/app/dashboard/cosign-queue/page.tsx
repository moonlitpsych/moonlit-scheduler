'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import {
  FileText,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw,
  User,
  Building2,
  Calendar,
  Users
} from 'lucide-react'

interface CosignQueueItem {
  id: string
  note_id: string
  patient_name: string
  payer_display_name: string
  resident_name: string
  note_date: string
  note_type: string | null
  service_name: string | null
  status: 'pending' | 'signed' | 'skipped'
  intakeq_note_url: string
  added_at: string
  signed_at: string | null
  supervisor_name: string | null
}

export default function CosignQueuePage() {
  const [items, setItems] = useState<CosignQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed'>('pending')
  const [payerFilter, setPayerFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine')
  const [payers, setPayers] = useState<string[]>([])
  const [providerId, setProviderId] = useState<string | null>(null)

  const supabase = createClientComponentClient<Database>()

  // Get current user's provider ID on mount
  useEffect(() => {
    const getProviderId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: provider } = await supabase
          .from('providers')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single()

        if (provider) {
          setProviderId(provider.id)
        }
      }
    }
    getProviderId()
  }, [supabase])

  // Fetch queue items
  const fetchQueue = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)
      if (payerFilter !== 'all') params.append('payer', payerFilter)
      // Filter by supervisor if viewing "mine" and we have a provider ID
      if (viewMode === 'mine' && providerId) {
        params.append('supervisor_id', providerId)
      }

      const response = await fetch(`/api/cosign-queue?${params}`)
      const data = await response.json()

      setItems(data.items || [])
      setPayers(data.payers || [])
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (providerId !== null) {
      fetchQueue()
    }
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [filter, payerFilter, viewMode, providerId])

  const pendingCount = items.filter(i => i.status === 'pending').length

  const openInIntakeQ = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
              Co-Signature Queue
            </h1>
            <p className="text-gray-600">
              Notes awaiting attending co-signature
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Pending badge */}
            {filter === 'pending' && (
              <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
                {pendingCount} pending
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={fetchQueue}
              className="p-2 text-gray-500 hover:text-[#BF9C73] rounded-lg hover:bg-[#FEF8F1] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            {/* View mode toggle - My Queue vs All */}
            <div className="flex gap-1 bg-[#BF9C73]/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('mine')}
                className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                  viewMode === 'mine'
                    ? 'bg-[#BF9C73] text-white shadow-sm'
                    : 'text-[#BF9C73] hover:text-[#091747]'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                My Queue
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                  viewMode === 'all'
                    ? 'bg-[#BF9C73] text-white shadow-sm'
                    : 'text-[#BF9C73] hover:text-[#091747]'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                All
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Filter:</span>
            </div>

            {/* Status filter */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['pending', 'signed', 'all'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === status
                      ? 'bg-white text-[#091747] shadow-sm'
                      : 'text-gray-600 hover:text-[#091747]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Payer filter */}
            {payers.length > 0 && (
              <select
                value={payerFilter}
                onChange={(e) => setPayerFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="all">All Payers</option>
                {payers.map(payer => (
                  <option key={payer} value={payer}>{payer}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Queue Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-[#BF9C73]" />
              <p>Loading queue...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No notes awaiting co-signature</p>
              <p className="text-gray-400 text-sm mt-1">
                {filter === 'pending' ? 'All caught up!' : 'No notes match your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Patient
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Payer
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Resident
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Note Date
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      {/* Status */}
                      <td className="px-4 py-3">
                        {item.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Pending</span>
                          </span>
                        ) : item.status === 'signed' ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Signed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">Skipped</span>
                          </span>
                        )}
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {item.patient_name}
                          </span>
                        </div>
                        {item.note_type && (
                          <span className="text-xs text-gray-500 ml-6">
                            {item.note_type}
                          </span>
                        )}
                      </td>

                      {/* Payer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {item.payer_display_name}
                          </span>
                        </div>
                      </td>

                      {/* Resident */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {item.resident_name}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900">
                              {formatDate(item.note_date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(item.note_date)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        {item.status === 'pending' ? (
                          <button
                            onClick={() => openInIntakeQ(item.intakeq_note_url)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#BF9C73] text-white text-sm font-medium rounded-lg hover:bg-[#a8875f] transition-colors"
                          >
                            <span>Review & Sign</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => openInIntakeQ(item.intakeq_note_url)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <span>View Note</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 text-sm text-gray-500">
          <p>
            Notes are automatically added when residents lock them in IntakeQ.
            Click "Review & Sign" to open the note in IntakeQ, unlock, add your co-signature, and re-lock.
          </p>
        </div>
      </div>
    </div>
  )
}

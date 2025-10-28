'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Loader2, AlertTriangle, CheckCircle2, Clock, TrendingUp, ExternalLink } from 'lucide-react'
import PayerSelectionPanel from './PayerSelectionPanel'
import CredentialingTaskList from './CredentialingTaskList'

interface ProviderCredentialingDashboardProps {
  providerId: string
}

interface Provider {
  id: string
  first_name: string
  last_name: string
  role: string
  npi: string | null
}

interface OverallStats {
  total_payers: number
  total_tasks: number
  completed_tasks: number
  in_progress_payers: number
  approved_payers: number
  pending_approval: number
}

interface PayerTaskGroup {
  payer_id: string
  payer_name: string
  payer_type: string
  requires_individual_contract: boolean
  application_status: string | null
  application_submitted_date: string | null
  approval_date: string | null
  effective_date: string | null
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  pending_tasks: number
  blocked_tasks: number
  completion_percentage: number
  tasks: any[]
}

export default function ProviderCredentialingDashboard({
  providerId
}: ProviderCredentialingDashboardProps) {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [payerGroups, setPayerGroups] = useState<PayerTaskGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'select' | 'tasks'>('select')

  useEffect(() => {
    loadDashboard()
  }, [providerId])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/admin/providers/${providerId}/credentialing-dashboard`)
      if (!res.ok) {
        throw new Error('Failed to load credentialing dashboard')
      }

      const data = await res.json()
      setProvider(data.data.provider)
      setStats(data.data.overall_stats)
      setPayerGroups(data.data.payers)
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err.message || 'Failed to load credentialing dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      const res = await fetch(`/api/admin/credentialing-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        throw new Error('Failed to update task')
      }

      // Reload dashboard to refresh data
      await loadDashboard()
    } catch (err: any) {
      console.error('Error updating task:', err)
      alert(err.message || 'Failed to update task')
    }
  }

  const handlePayersSelected = async () => {
    // Switch to tasks tab and reload data
    setActiveTab('tasks')
    await loadDashboard()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Loading credentialing dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={loadDashboard}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Provider not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Provider header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {provider.first_name} {provider.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                <span>{provider.role}</span>
                {provider.npi && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span>NPI: {provider.npi}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/bookability"
              className="px-4 py-2 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View All Relationships
            </Link>
            <button
              onClick={loadDashboard}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats overview */}
      {stats && stats.total_payers > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Payers</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_payers}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasks Progress</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.completed_tasks} / {stats.total_tasks}
                </p>
                <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{stats.approved_payers}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.pending_approval}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('select')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'select'
                ? 'border-indigo-600 text-indigo-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Select Payers
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'tasks'
                ? 'border-indigo-600 text-indigo-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Credentialing Tasks
            {stats && stats.total_tasks > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                {stats.total_tasks}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'select' && (
          <PayerSelectionPanel
            providerId={providerId}
            onPayersSelected={handlePayersSelected}
            showGenerateButton={true}
          />
        )}

        {activeTab === 'tasks' && (
          <CredentialingTaskList
            payerGroups={payerGroups}
            onTaskUpdate={handleTaskUpdate}
            readOnly={false}
          />
        )}
      </div>
    </div>
  )
}

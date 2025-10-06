'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Users, FileText, Calendar, RefreshCw, Download } from 'lucide-react'

interface HealthMetric {
  provider_id?: string
  provider_name?: string
  payer_id?: string
  payer_name?: string
  effective_date?: string
  expiration_date?: string
  updated_at?: string
}

interface HealthData {
  providers_zero_payers: HealthMetric[]
  payers_zero_providers: HealthMetric[]
  contracts_expiring: {
    days_30: HealthMetric[]
    days_60: HealthMetric[]
    days_90: HealthMetric[]
  }
  providers_no_contracts: HealthMetric[]
}

interface DetailDrawerProps {
  title: string
  data: HealthMetric[]
  isOpen: boolean
  onClose: () => void
  type: 'provider' | 'payer' | 'contract'
}

const DetailDrawer = ({ title, data, isOpen, onClose, type }: DetailDrawerProps) => {
  const exportToCsv = () => {
    const headers = type === 'contract'
      ? ['Provider Name', 'Payer Name', 'Effective Date', 'Expiration Date', 'Last Updated']
      : type === 'provider'
        ? ['Provider ID', 'Provider Name']
        : ['Payer ID', 'Payer Name']

    const rows = data.map(item => {
      if (type === 'contract') {
        return [
          item.provider_name || '',
          item.payer_name || '',
          item.effective_date || '',
          item.expiration_date || '',
          item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''
        ]
      } else if (type === 'provider') {
        return [item.provider_id || '', item.provider_name || '']
      } else {
        return [item.payer_id || '', item.payer_name || '']
      }
    })

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookability_health_${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">{title}</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCsv}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {data.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <Users className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600">No items found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50">
                  <tr>
                    {type === 'contract' ? (
                      <>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Provider</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Payer</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Effective Date</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Expiration Date</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Last Updated</th>
                      </>
                    ) : type === 'provider' ? (
                      <>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Provider ID</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Provider Name</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Payer ID</th>
                        <th className="px-4 py-3 text-left font-medium text-[#091747]">Payer Name</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {data.map((item, index) => (
                    <tr key={index} className="hover:bg-stone-50">
                      {type === 'contract' ? (
                        <>
                          <td className="px-4 py-3 text-[#091747]">{item.provider_name}</td>
                          <td className="px-4 py-3 text-[#091747]">{item.payer_name}</td>
                          <td className="px-4 py-3 text-[#091747]">
                            {item.effective_date ? new Date(item.effective_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-[#091747]">
                            {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-[#091747]">
                            {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
                          </td>
                        </>
                      ) : type === 'provider' ? (
                        <>
                          <td className="px-4 py-3 text-xs text-[#091747]/60 font-mono">{item.provider_id}</td>
                          <td className="px-4 py-3 text-[#091747] font-medium">{item.provider_name}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-xs text-[#091747]/60 font-mono">{item.payer_id}</td>
                          <td className="px-4 py-3 text-[#091747] font-medium">{item.payer_name}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookabilityHealthPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedExpiringDays, setSelectedExpiringDays] = useState<30 | 60 | 90>(30)
  const [activeDrawer, setActiveDrawer] = useState<{
    title: string
    data: HealthMetric[]
    type: 'provider' | 'payer' | 'contract'
  } | null>(null)

  const fetchHealthData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching bookability health data...')

      const response = await fetch(`/api/admin/bookability/health?date=${selectedDate}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch health data')
      }

      console.log('✅ Health data fetched successfully')
      setHealthData(result.data)

    } catch (error: any) {
      console.error('❌ Error fetching health data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()
  }, [selectedDate])

  const getExpiringContracts = () => {
    if (!healthData) return []
    switch (selectedExpiringDays) {
      case 30: return healthData.contracts_expiring.days_30
      case 60: return healthData.contracts_expiring.days_60
      case 90: return healthData.contracts_expiring.days_90
      default: return healthData.contracts_expiring.days_30
    }
  }

  const HealthCard = ({
    title,
    count,
    icon: Icon,
    variant,
    description,
    onClick
  }: {
    title: string
    count: number
    icon: any
    variant: 'danger' | 'warning' | 'info'
    description: string
    onClick: () => void
  }) => {
    const cardColors = {
      danger: 'border-red-200 bg-red-50 hover:bg-red-100',
      warning: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
      info: 'border-blue-200 bg-blue-50 hover:bg-blue-100'
    }

    const iconColors = {
      danger: 'text-red-600',
      warning: 'text-amber-600',
      info: 'text-blue-600'
    }

    const countColors = {
      danger: 'text-red-700',
      warning: 'text-amber-700',
      info: 'text-blue-700'
    }

    return (
      <div
        className={`p-6 rounded-lg border cursor-pointer transition-colors ${cardColors[variant]}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <Icon className={`h-6 w-6 ${iconColors[variant]}`} />
          <div className={`text-2xl font-bold ${countColors[variant]}`}>
            {count}
          </div>
        </div>
        <h3 className="font-semibold text-[#091747] mb-2">{title}</h3>
        <p className="text-sm text-[#091747]/60">{description}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 max-w-full">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#BF9C73] border-t-transparent"></div>
          <p className="mt-4 text-[#091747]/60">Loading health data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
              Bookability Health
            </h1>
            <p className="text-[#091747]/60 mt-1">
              Monitor critical bookability issues and contract status
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
            />
            <button
              onClick={fetchHealthData}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-[#BF9C73]/50 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <HealthCard
          title="Providers with Zero Payers"
          count={healthData?.providers_zero_payers.length || 0}
          icon={AlertTriangle}
          variant="danger"
          description="Bookable providers who accept no payers"
          onClick={() => setActiveDrawer({
            title: 'Providers with Zero Bookable Payers',
            data: healthData?.providers_zero_payers || [],
            type: 'provider'
          })}
        />

        <HealthCard
          title="Payers with Zero Providers"
          count={healthData?.payers_zero_providers.length || 0}
          icon={Users}
          variant="danger"
          description="Active payers with no accepting providers"
          onClick={() => setActiveDrawer({
            title: 'Payers with Zero Accepting Providers',
            data: healthData?.payers_zero_providers || [],
            type: 'payer'
          })}
        />

        <HealthCard
          title={`Contracts Expiring in ${selectedExpiringDays} Days`}
          count={getExpiringContracts().length}
          icon={Calendar}
          variant="warning"
          description="Active contracts nearing expiration"
          onClick={() => setActiveDrawer({
            title: `Contracts Expiring in ${selectedExpiringDays} Days`,
            data: getExpiringContracts(),
            type: 'contract'
          })}
        />

        <HealthCard
          title="Providers Missing Contracts"
          count={healthData?.providers_no_contracts.length || 0}
          icon={FileText}
          variant="warning"
          description="Bookable providers with no effective contracts"
          onClick={() => setActiveDrawer({
            title: 'Providers Missing Effective Contracts',
            data: healthData?.providers_no_contracts || [],
            type: 'provider'
          })}
        />
      </div>

      {/* Contract Expiration Controls */}
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-[#091747]">Contract expiration window:</span>
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => setSelectedExpiringDays(days as 30 | 60 | 90)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedExpiringDays === days
                  ? 'bg-[#BF9C73] text-white'
                  : 'bg-stone-100 text-[#091747] hover:bg-stone-200'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Detail Drawer */}
      {activeDrawer && (
        <DetailDrawer
          title={activeDrawer.title}
          data={activeDrawer.data}
          type={activeDrawer.type}
          isOpen={!!activeDrawer}
          onClose={() => setActiveDrawer(null)}
        />
      )}
    </div>
  )
}
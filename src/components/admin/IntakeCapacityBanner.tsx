'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'

interface IntakeCapacityData {
  week_start: string
  week_end: string
  total_slots: number
  providers: Array<{
    provider_id: string
    provider_name: string
    slot_count: number
  }>
  has_data: boolean
}

export default function IntakeCapacityBanner() {
  const [data, setData] = useState<IntakeCapacityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCapacity()
  }, [])

  const fetchCapacity = async () => {
    try {
      const response = await fetch('/api/admin/intake-slots')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching intake capacity:', error)
    } finally {
      setLoading(false)
    }
  }

  // Don't render anything if loading or no data
  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-200 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-5 bg-stone-200 rounded w-48 mb-2"></div>
            <div className="h-4 bg-stone-200 rounded w-64"></div>
          </div>
        </div>
      </div>
    )
  }

  // Hide banner if no data for this week
  if (!data?.has_data) {
    return null
  }

  // Format date range
  const formatDateRange = () => {
    const start = new Date(data.week_start + 'T00:00:00')
    const end = new Date(data.week_end + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  }

  // Build provider breakdown string
  const providerBreakdown = data.providers
    .filter(p => p.slot_count > 0)
    .map(p => {
      // Use first name only for brevity
      const firstName = p.provider_name.split(' ')[0]
      return `${firstName}: ${p.slot_count}`
    })
    .join(' | ')

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-emerald-700">
                {data.total_slots}
              </span>
              <span className="text-emerald-700 font-medium">
                intake slots this week
              </span>
            </div>
            <div className="text-sm text-emerald-600/80">
              {providerBreakdown && (
                <span className="mr-3">{providerBreakdown}</span>
              )}
              <span className="text-emerald-500">({formatDateRange()})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

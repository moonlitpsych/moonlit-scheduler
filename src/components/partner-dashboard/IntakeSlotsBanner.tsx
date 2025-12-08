'use client'

import { useState, useEffect } from 'react'
import { Stethoscope } from 'lucide-react'

interface IntakeSlotsData {
  week_start: string
  week_end: string
  total_slots: number
  has_data: boolean
  greeting: string
  message: string | null
}

export default function IntakeSlotsBanner() {
  const [data, setData] = useState<IntakeSlotsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSlots()
  }, [])

  const fetchSlots = async () => {
    try {
      const response = await fetch('/api/partner-dashboard/intake-slots')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching intake slots:', error)
    } finally {
      setLoading(false)
    }
  }

  // Don't render anything if loading
  if (loading) {
    return (
      <div className="bg-moonlit-cream border-2 border-moonlit-brown/20 rounded-lg p-4 mb-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-moonlit-brown/20 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-5 bg-moonlit-brown/20 rounded w-80"></div>
          </div>
        </div>
      </div>
    )
  }

  // Hide banner completely if no data for this week
  if (!data?.has_data || !data?.message) {
    return null
  }

  // Format date range for subtitle
  const formatDateRange = () => {
    const start = new Date(data.week_start + 'T00:00:00')
    const end = new Date(data.week_end + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
    return `Week of ${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
  }

  return (
    <div className="bg-moonlit-cream border-2 border-moonlit-brown/20 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-moonlit-peach/50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-5 h-5 text-moonlit-brown" />
        </div>
        <div>
          <p className="text-moonlit-navy font-medium font-['Newsreader']">
            {data.message}
          </p>
          <p className="text-sm text-moonlit-navy/60 font-['Newsreader']">
            {formatDateRange()}
          </p>
        </div>
      </div>
    </div>
  )
}

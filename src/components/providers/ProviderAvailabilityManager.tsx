'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Calendar, Clock, Save, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ProviderAvailabilityManagerProps {
  providerId: string
  providerName?: string
}

export default function ProviderAvailabilityManager({ 
  providerId, 
  providerName = 'Provider' 
}: ProviderAvailabilityManagerProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClientComponentClient()

  // Simple test to verify connection
  useEffect(() => {
    testConnection()
  }, [])

  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('id, first_name, last_name')
        .eq('id', providerId)
        .single()
      
      if (data) {
        console.log('Provider found:', data)
      }
    } catch (error) {
      console.error('Connection test error:', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setSuccess(false)
    
    // Simulate save
    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-[#BF9C73]" />
            <h2 className="text-2xl font-semibold text-[#091747] font-['Newsreader']">
              Availability Settings for {providerName}
            </h2>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#BF9C73]/90 disabled:opacity-50"
          >
            {loading ? (
              <span>Saving...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">Settings saved successfully!</p>
          </div>
        )}
      </div>

      {/* Weekly Schedule Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Clock className="w-6 h-6 text-[#BF9C73]" />
          <h3 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
            Weekly Schedule
          </h3>
        </div>
        
        <div className="space-y-4">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
            <div key={day} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <span className="font-medium text-[#091747]">{day}</span>
              <div className="flex items-center space-x-4">
                <input
                  type="time"
                  defaultValue="09:00"
                  className="px-3 py-1 border border-gray-300 rounded"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="time"
                  defaultValue="17:00"
                  className="px-3 py-1 border border-gray-300 rounded"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Settings Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-6 h-6 text-[#BF9C73]" />
          <h3 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
            Booking Settings
          </h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-1">
              Max Daily Appointments
            </label>
            <input
              type="number"
              defaultValue={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-1">
              Buffer Time (minutes)
            </label>
            <input
              type="number"
              defaultValue={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-1">
              Advance Booking (days)
            </label>
            <input
              type="number"
              defaultValue={90}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-1">
              Minimum Notice (hours)
            </label>
            <input
              type="number"
              defaultValue={24}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-sm text-[#091747]">Enable Telehealth</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-sm text-[#091747]">Enable In-Person</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="rounded" />
            <span className="text-sm text-[#091747]">Accept New Patients</span>
          </label>
        </div>
      </div>
    </div>
  )
}
// src/components/partner-dashboard/CalendarExport.tsx
// Calendar export component for partner dashboard

'use client'

import { useState } from 'react'
import { Calendar, Download, Link, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { PartnerUser } from '@/types/partner-types'

interface CalendarExportProps {
  partnerUser: PartnerUser
}

type ExportFormat = 'ics' | 'outlook' | 'google'
type ExportStatus = 'idle' | 'loading' | 'success' | 'error'

interface ExportOptions {
  format: ExportFormat
  date_range: {
    start_date: string
    end_date: string
  }
  include_all_org_appointments: boolean
}

export function CalendarExport({ partnerUser }: CalendarExportProps) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportMessage, setExportMessage] = useState<string>('')
  const [showOptions, setShowOptions] = useState(false)
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'ics',
    date_range: {
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    include_all_org_appointments: false
  })

  const handleExport = async (format?: ExportFormat) => {
    const selectedFormat = format || exportOptions.format
    setExportStatus('loading')
    setExportMessage('Generating calendar export...')

    try {
      console.log('📅 Starting calendar export:', {
        format: selectedFormat,
        partner_user_id: partnerUser.id,
        options: exportOptions
      })

      const response = await fetch('/api/partner/calendar-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partner_user_id: partnerUser.id,
          format: selectedFormat,
          date_range: exportOptions.date_range,
          organization_id: partnerUser.organization_id,
          include_all_org_appointments: exportOptions.include_all_org_appointments
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      // Handle file download
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `moonlit-appointments-${selectedFormat}.${selectedFormat === 'ics' ? 'ics' : 'csv'}`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportStatus('success')
      setExportMessage(`Calendar exported successfully as ${filename}`)
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('idle')
        setExportMessage('')
      }, 3000)

    } catch (error: any) {
      console.error('❌ Calendar export error:', error)
      setExportStatus('error')
      setExportMessage(error.message || 'Failed to export calendar')
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setExportStatus('idle')
        setExportMessage('')
      }, 5000)
    }
  }

  const handleQuickExport = (format: ExportFormat) => {
    setExportOptions(prev => ({ ...prev, format }))
    handleExport(format)
  }

  const formatOptions = [
    {
      id: 'ics' as const,
      name: 'iCalendar (.ics)',
      description: 'Universal format for Apple Calendar, Outlook, Google Calendar, and more',
      icon: Calendar,
      recommended: true
    },
    {
      id: 'outlook' as const,
      name: 'Outlook CSV',
      description: 'Optimized for Microsoft Outlook import',
      icon: Calendar
    },
    {
      id: 'google' as const,
      name: 'Google CSV',
      description: 'Optimized for Google Calendar import',
      icon: Calendar
    }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-moonlit-navy mb-1 font-['Newsreader']">
            Calendar Export
          </h3>
          <p className="text-sm text-gray-600 font-['Newsreader'] font-light">
            Export your patient appointments to external calendar applications
          </p>
        </div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="text-moonlit-brown hover:text-moonlit-brown/80 text-sm font-medium"
        >
          {showOptions ? 'Hide Options' : 'Show Options'}
        </button>
      </div>

      {/* Export Status */}
      {exportStatus !== 'idle' && (
        <div className={`mb-6 p-4 rounded-lg border ${
          exportStatus === 'loading' ? 'bg-blue-50 border-blue-200' :
          exportStatus === 'success' ? 'bg-green-50 border-green-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {exportStatus === 'loading' && <Clock className="w-4 h-4 text-blue-600 animate-spin" />}
            {exportStatus === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
            {exportStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
            <span className={`text-sm font-medium ${
              exportStatus === 'loading' ? 'text-blue-800' :
              exportStatus === 'success' ? 'text-green-800' :
              'text-red-800'
            }`}>
              {exportMessage}
            </span>
          </div>
        </div>
      )}

      {/* Quick Export Buttons */}
      <div className="space-y-4 mb-6">
        <h4 className="text-sm font-medium text-gray-700 font-['Newsreader']">Quick Export</h4>
        <div className="grid grid-cols-1 gap-3">
          {formatOptions.map((format) => (
            <button
              key={format.id}
              onClick={() => handleQuickExport(format.id)}
              disabled={exportStatus === 'loading'}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-moonlit-brown hover:bg-moonlit-cream/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center space-x-3">
                <format.icon className="w-5 h-5 text-moonlit-brown flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-900 font-['Newsreader'] flex items-center">
                    {format.name}
                    {format.recommended && (
                      <span className="ml-2 text-xs bg-moonlit-brown text-white px-2 py-0.5 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 font-['Newsreader'] font-light mt-1">
                    {format.description}
                  </div>
                </div>
              </div>
              <Download className="w-4 h-4 text-moonlit-brown opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options */}
      {showOptions && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4 font-['Newsreader']">Export Options</h4>
          
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Start Date
                </label>
                <input
                  type="date"
                  value={exportOptions.date_range.start_date}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    date_range: { ...prev.date_range, start_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  End Date
                </label>
                <input
                  type="date"
                  value={exportOptions.date_range.end_date}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    date_range: { ...prev.date_range, end_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>
            </div>

            {/* Include All Organization Appointments */}
            <div className="flex items-center">
              <input
                id="include-all-org"
                type="checkbox"
                checked={exportOptions.include_all_org_appointments}
                onChange={(e) => setExportOptions(prev => ({
                  ...prev,
                  include_all_org_appointments: e.target.checked
                }))}
                className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
              />
              <label htmlFor="include-all-org" className="ml-2 text-sm text-gray-700 font-['Newsreader']">
                Include all organization appointments (requires additional permissions)
              </label>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 font-['Newsreader']">
                Export Format
              </label>
              <div className="space-y-2">
                {formatOptions.map((format) => (
                  <label key={format.id} className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value={format.id}
                      checked={exportOptions.format === format.id}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        format: e.target.value as ExportFormat
                      }))}
                      className="w-4 h-4 text-moonlit-brown border-gray-300 focus:ring-moonlit-brown"
                    />
                    <span className="ml-2 text-sm text-gray-700 font-['Newsreader']">
                      {format.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Export Button */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 font-['Newsreader'] font-light">
                Export with custom settings
              </div>
              <button
                onClick={() => handleExport()}
                disabled={exportStatus === 'loading'}
                className="flex items-center space-x-2 px-4 py-2 bg-moonlit-brown hover:bg-moonlit-brown/90 text-white rounded-lg font-medium font-['Newsreader'] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>Export Calendar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-moonlit-cream/30 rounded-lg">
        <div className="flex items-start space-x-2">
          <Calendar className="w-4 h-4 text-moonlit-brown mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700 font-['Newsreader'] font-light">
            <strong className="font-medium">How to use:</strong> Choose a format above to download your patient appointments. 
            The iCalendar (.ics) format works with most calendar applications. After downloading, you can import the file 
            into your preferred calendar app to view appointments alongside your other commitments.
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalendarExport
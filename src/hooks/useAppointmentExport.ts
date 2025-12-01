// Hook for individual appointment calendar export
import { useState } from 'react'
import { AppointmentExportData } from '@/lib/services/calendarExportService'

export function useAppointmentExport() {
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [exportMessage, setExportMessage] = useState<string>('')

  const exportSingleAppointment = async (appointment: any, format: 'ics' | 'outlook' | 'google' = 'ics') => {
    setExportStatus('loading')
    setExportMessage('Exporting appointment...')

    try {
      // Transform appointment data to export format
      // Prefer practiceq_generated_google_meet, fall back to meeting_url
      const meetingUrl = appointment.practiceq_generated_google_meet || appointment.meeting_url || null

      const exportData: AppointmentExportData = {
        id: appointment.id,
        patient_name: `${appointment.patients.first_name} ${appointment.patients.last_name}`,
        provider_name: `Dr. ${appointment.providers.first_name} ${appointment.providers.last_name}`,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        appointment_type: appointment.appointment_type || 'Consultation',
        location: 'Telehealth',
        notes: appointment.notes || '',
        status: appointment.status || 'confirmed',
        patient_phone: appointment.patients.phone,
        organization_name: 'Partner Organization',
        meeting_url: meetingUrl
      }

      // Create calendar export directly using the service
      const { calendarExportService } = await import('@/lib/services/calendarExportService')
      const exportResult = await calendarExportService.exportAppointments([exportData], format, 'Moonlit Health')

      // Create download
      const blob = new Blob([exportResult.content], { type: exportResult.mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportResult.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setExportStatus('success')
      setExportMessage('Appointment exported successfully!')
      
      // Reset after 3 seconds
      setTimeout(() => {
        setExportStatus('idle')
        setExportMessage('')
      }, 3000)

    } catch (error: any) {
      console.error('Export error:', error)
      setExportStatus('error')
      setExportMessage('Failed to export appointment')
      
      // Reset after 5 seconds
      setTimeout(() => {
        setExportStatus('idle')
        setExportMessage('')
      }, 5000)
    }
  }

  return {
    exportSingleAppointment,
    exportStatus,
    exportMessage
  }
}
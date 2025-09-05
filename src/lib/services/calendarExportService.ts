// src/lib/services/calendarExportService.ts
// Calendar export service for partner dashboard appointments

interface AppointmentExportData {
  id: string
  patient_name: string
  provider_name: string
  start_time: string
  end_time: string
  appointment_type?: string
  location?: string
  notes?: string
  status?: string
  patient_phone?: string
  provider_phone?: string
  organization_name?: string
}

export type CalendarFormat = 'ics' | 'outlook' | 'google'

class CalendarExportService {
  
  /**
   * Export appointments to various calendar formats
   */
  async exportAppointments(
    appointments: AppointmentExportData[], 
    format: CalendarFormat,
    organizationName: string = 'Moonlit Health'
  ): Promise<{ content: string; filename: string; mimeType: string }> {
    switch (format) {
      case 'ics':
        return this.generateICS(appointments, organizationName)
      case 'outlook':
        return this.generateOutlookCSV(appointments, organizationName)
      case 'google':
        return this.generateGoogleCSV(appointments, organizationName)
      default:
        throw new Error(`Unsupported calendar format: ${format}`)
    }
  }

  /**
   * Generate iCalendar (.ics) format - Universal standard
   */
  private generateICS(appointments: AppointmentExportData[], organizationName: string) {
    const now = new Date()
    const timestamp = this.formatICSDate(now)
    
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Moonlit Health//Partner Dashboard//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${organizationName} - Patient Appointments`,
      'X-WR-TIMEZONE:America/Denver',
      'X-WR-CALDESC:Patient appointments exported from Moonlit Health Partner Dashboard'
    ]

    appointments.forEach(apt => {
      // Create unique UID that includes appointment ID and last modified time for overwrite protection
      const uid = `apt-${apt.id}@moonlit.health`
      const startDate = this.formatICSDate(new Date(apt.start_time))
      const endDate = this.formatICSDate(new Date(apt.end_time))
      const summary = `${apt.patient_name} - ${apt.provider_name}`
      const location = apt.location || 'Telehealth'
      const status = apt.status?.toUpperCase() || 'CONFIRMED'
      
      // Add sequence number for calendar update handling
      const sequence = 1 // Could be incremented based on appointment updates
      
      // Create detailed description
      const description = this.escapeICSText([
        `Patient: ${apt.patient_name}`,
        `Provider: ${apt.provider_name}`,
        apt.appointment_type && `Type: ${apt.appointment_type}`,
        apt.patient_phone && `Patient Phone: ${apt.patient_phone}`,
        apt.organization_name && `Referred by: ${apt.organization_name}`,
        apt.notes && `Notes: ${apt.notes}`,
        '',
        'Exported from Moonlit Health Partner Dashboard'
      ].filter(Boolean).join('\\n'))

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${timestamp}`,
        `SEQUENCE:${sequence}`,
        `DTSTART:${startDate}`,
        `DTEND:${endDate}`,
        `SUMMARY:${this.escapeICSText(summary)}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${this.escapeICSText(location)}`,
        `STATUS:${status}`,
        'CATEGORIES:Healthcare,Patient Appointment',
        'PRIORITY:5',
        'CLASS:CONFIDENTIAL',
        'END:VEVENT'
      )
    })

    icsContent.push('END:VCALENDAR')

    return {
      content: icsContent.join('\r\n'),
      filename: `moonlit-appointments-${this.formatFilenameDate(now)}.ics`,
      mimeType: 'text/calendar'
    }
  }

  /**
   * Generate Outlook CSV format
   */
  private generateOutlookCSV(appointments: AppointmentExportData[], organizationName: string) {
    const headers = [
      'Subject',
      'Start Date',
      'Start Time', 
      'End Date',
      'End Time',
      'All day event',
      'Description',
      'Location',
      'Categories'
    ]

    const rows = appointments.map(apt => {
      const startDate = new Date(apt.start_time)
      const endDate = new Date(apt.end_time)
      
      const description = [
        `Patient: ${apt.patient_name}`,
        `Provider: ${apt.provider_name}`,
        apt.appointment_type && `Type: ${apt.appointment_type}`,
        apt.patient_phone && `Patient Phone: ${apt.patient_phone}`,
        apt.organization_name && `Referred by: ${apt.organization_name}`,
        apt.notes && `Notes: ${apt.notes}`,
        '',
        'Exported from Moonlit Health Partner Dashboard'
      ].filter(Boolean).join('; ')

      return [
        `"${apt.patient_name} - ${apt.provider_name}"`,
        `"${startDate.toLocaleDateString()}"`,
        `"${startDate.toLocaleTimeString()}"`,
        `"${endDate.toLocaleDateString()}"`,
        `"${endDate.toLocaleTimeString()}"`,
        '"False"',
        `"${description}"`,
        `"${apt.location || 'Telehealth'}"`,
        '"Healthcare,Patient Appointment"'
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    
    return {
      content: csvContent,
      filename: `moonlit-appointments-outlook-${this.formatFilenameDate(new Date())}.csv`,
      mimeType: 'text/csv'
    }
  }

  /**
   * Generate Google Calendar CSV format
   */
  private generateGoogleCSV(appointments: AppointmentExportData[], organizationName: string) {
    const headers = [
      'Subject',
      'Start Date',
      'Start Time',
      'End Date', 
      'End Time',
      'All Day Event',
      'Description',
      'Location',
      'Private'
    ]

    const rows = appointments.map(apt => {
      const startDate = new Date(apt.start_time)
      const endDate = new Date(apt.end_time)
      
      const description = [
        `Patient: ${apt.patient_name}`,
        `Provider: ${apt.provider_name}`,
        apt.appointment_type && `Type: ${apt.appointment_type}`,
        apt.patient_phone && `Phone: ${apt.patient_phone}`,
        apt.organization_name && `Referred by: ${apt.organization_name}`,
        apt.notes && `Notes: ${apt.notes}`,
        '',
        'From Moonlit Health Partner Dashboard'
      ].filter(Boolean).join(' | ')

      return [
        `"${apt.patient_name} - ${apt.provider_name}"`,
        `"${this.formatGoogleDate(startDate)}"`,
        `"${this.formatGoogleTime(startDate)}"`,
        `"${this.formatGoogleDate(endDate)}"`,
        `"${this.formatGoogleTime(endDate)}"`,
        '"False"',
        `"${description}"`,
        `"${apt.location || 'Telehealth'}"`,
        '"True"'
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    
    return {
      content: csvContent,
      filename: `moonlit-appointments-google-${this.formatFilenameDate(new Date())}.csv`,
      mimeType: 'text/csv'
    }
  }

  /**
   * Generate calendar subscription URL for ongoing sync
   */
  generateSubscriptionURL(partnerId: string, token: string, baseUrl: string): {
    ics: string
    webcal: string
    google: string
  } {
    const baseSubscriptionUrl = `${baseUrl}/api/partner/calendar-feed`
    const params = `?partner_id=${partnerId}&token=${token}`
    
    return {
      ics: `${baseSubscriptionUrl}${params}&format=ics`,
      webcal: `webcal://${baseUrl.replace(/^https?:\/\//, '')}${baseSubscriptionUrl.replace(baseUrl, '')}${params}&format=ics`,
      google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`${baseSubscriptionUrl}${params}&format=ics`)}`
    }
  }

  // Helper methods for formatting

  private formatICSDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  private formatGoogleDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }

  private formatGoogleTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  private formatFilenameDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private escapeICSText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '')
  }

  /**
   * Generate quick add URLs for major calendar services
   */
  generateQuickAddUrls(appointment: AppointmentExportData): {
    google: string
    outlook: string
    yahoo: string
  } {
    const startDate = new Date(appointment.start_time)
    const endDate = new Date(appointment.end_time)
    const title = encodeURIComponent(`${appointment.patient_name} - ${appointment.provider_name}`)
    const details = encodeURIComponent([
      `Patient: ${appointment.patient_name}`,
      `Provider: ${appointment.provider_name}`,
      appointment.appointment_type && `Type: ${appointment.appointment_type}`,
      appointment.location && `Location: ${appointment.location}`,
      appointment.notes && `Notes: ${appointment.notes}`
    ].filter(Boolean).join('\n'))
    const location = encodeURIComponent(appointment.location || 'Telehealth')

    // Format dates for URL parameters
    const googleStartDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const googleEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${googleStartDate}/${googleEndDate}&details=${details}&location=${location}`,
      
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${details}&location=${location}`,
      
      yahoo: `https://calendar.yahoo.com/?v=60&title=${title}&st=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}&et=${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}&desc=${details}&in_loc=${location}`
    }
  }

  /**
   * Create calendar feed for real-time subscription (requires authentication)
   */
  async generateCalendarFeed(
    partnerId: string, 
    format: 'ics' | 'json' = 'ics',
    dateRange?: { start: Date; end: Date }
  ): Promise<string> {
    // This would fetch appointments from database based on partner access
    // For now, return a placeholder structure
    
    if (format === 'ics') {
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Moonlit Health//Partner Calendar Feed//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Moonlit Health - Patient Appointments',
        'X-WR-TIMEZONE:America/Denver',
        'X-PUBLISHED-TTL:PT1H',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        '# This feed updates hourly with your patient appointments',
        'END:VCALENDAR'
      ].join('\r\n')
    }
    
    return JSON.stringify({
      calendar_name: 'Moonlit Health - Patient Appointments',
      partner_id: partnerId,
      last_updated: new Date().toISOString(),
      appointments: [],
      next_update: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    })
  }
}

export const calendarExportService = new CalendarExportService()
export type { AppointmentExportData }
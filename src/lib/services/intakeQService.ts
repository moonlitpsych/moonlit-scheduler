// src/lib/services/intakeQService.ts
import { intakeQRateLimiter } from './rateLimiter'
import { intakeQCache } from './intakeQCache'
import { assertValidIntakeqClientId } from '../intakeq/utils'

interface IntakeQAppointment {
  PractitionerId: string
  ClientId: string
  ServiceId: string
  LocationId: string
  Status: 'Confirmed' | 'WaitingConfirmation'
  StartDate: number // Unix timestamp
  EndDate: number // Unix timestamp
  StartDateIso: string // ISO string
  EndDateIso: string // ISO string
  SendClientEmailNotification?: boolean
}

interface IntakeQClient {
  FirstName: string
  LastName: string
  Email: string
  Phone: string
  DateOfBirth?: string
}

interface IntakeQAppointmentResponse {
  Id: number
  PractitionerId: string
  ClientId: string
  ServiceId: string
  LocationId: string
  Status: string
  StartDate: number // Unix timestamp in milliseconds
  EndDate: number
  StartDateIso: string // ISO format like "2025-10-01T20:00:00.0000000Z"
  EndDateIso: string
  // ... other response fields
}

class IntakeQService {
  private baseUrl = 'https://intakeq.com/api/v1'
  private apiKey: string
  private requestCount = 0
  private dailyRequestCount = 0
  private lastRequestTime = 0
  private lastDayReset = new Date().getDate()

  constructor() {
    // WORKAROUND: Next.js 15.5.4 has a bug parsing .env.local that concatenates lines
    // Extracting the correct API key from the malformed environment variable
    const rawKey = process.env.INTAKEQ_API_KEY || ''

    // If the key contains the expected prefix and is too long, extract just the 40-char key
    if (rawKey.startsWith('4d09ac93') && rawKey.length > 40) {
      this.apiKey = rawKey.substring(0, 40)
      console.log('⚠️ [IntakeQ Init] Worked around Next.js .env parsing bug')
    } else {
      this.apiKey = rawKey
    }

    if (!this.apiKey) {
      console.warn('⚠️ IntakeQ API key not found. Set INTAKEQ_API_KEY environment variable.')
    }

    // Debug log on initialization (sanitized)
    if (process.env.INTEGRATIONS_DEBUG_HTTP === 'true') {
      console.log('🔑 [IntakeQ Init] API Key loaded:', this.apiKey ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'NOT SET')
      console.log('🔑 [IntakeQ Init] API Key length:', this.apiKey.length)
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Update counters for legacy tracking (used by getRateLimitStatus)
    const now = Date.now()
    const currentDay = new Date().getDate()

    if (currentDay !== this.lastDayReset) {
      this.dailyRequestCount = 0
      this.lastDayReset = currentDay
    }

    // Check daily limit (safety check)
    if (this.dailyRequestCount >= 500) {
      throw new Error('Daily API limit reached (500 requests)')
    }

    const url = `${this.baseUrl}${endpoint}`

    // Debug logging when flag is enabled
    const debugEnabled = process.env.INTEGRATIONS_DEBUG_HTTP === 'true'
    if (debugEnabled) {
      console.log('🔍 [IntakeQ Debug] Request:', {
        url,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Key': this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT_SET',
          ...options.headers,
        },
        bodyShape: options.body ? Object.keys(JSON.parse(options.body as string)) : undefined
      })
    }

    // Use production-ready rate limiter with queuing and backoff
    const response = await intakeQRateLimiter.makeRequest(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.apiKey,
        ...options.headers,
      },
    })

    // Update legacy counters
    this.requestCount++
    this.dailyRequestCount++
    this.lastRequestTime = now

    return response.json()
  }

  async createClient(clientData: IntakeQClient): Promise<{ Id: string }> {
    console.log('📝 Creating IntakeQ client...')
    
    try {
      const response = await this.makeRequest<{ ClientId: number }>('/clients', {
        method: 'POST',
        body: JSON.stringify(clientData),
      })
      
      console.log(`✅ IntakeQ client created: ${response.ClientId}`)
      return { Id: response.ClientId.toString() }
    } catch (error: any) {
      console.error('❌ Failed to create IntakeQ client:', error.message)
      throw error
    }
  }

  /**
   * Create appointment with existing client ID
   */
  async createAppointmentWithClient(appointmentData: {
    clientId: string
    practitionerId: string
    serviceId: string
    locationId: string
    dateTime: Date
    status?: 'Confirmed' | 'WaitingConfirmation'
    sendEmailNotification?: boolean
  }): Promise<string> {
    console.log('📅 Creating IntakeQ appointment with existing client...')

    try {
      // CRITICAL: Validate client ID format before API call
      // This catches malformed IDs like {"Id":"98"} or stringified JSON
      assertValidIntakeqClientId(appointmentData.clientId)
      console.log(`✅ IntakeQ ClientId validation passed: "${appointmentData.clientId}" (type: ${typeof appointmentData.clientId})`)

      // IntakeQ requires timestamps in milliseconds and times must be on 5-minute boundaries
      const appointmentDateTime = new Date(appointmentData.dateTime)
      const minutes = appointmentDateTime.getMinutes()
      const roundedMinutes = Math.round(minutes / 5) * 5
      appointmentDateTime.setMinutes(roundedMinutes, 0, 0) // Round to 5-min interval, zero seconds/ms

      const utcTimestamp = appointmentDateTime.getTime()

      console.log(`🕐 Appointment DateTime: ${appointmentData.dateTime.toISOString()}`)
      console.log(`🕐 UTC Timestamp: ${utcTimestamp}`)

      const appointmentPayload: IntakeQAppointment = {
        PractitionerId: appointmentData.practitionerId,
        ClientId: appointmentData.clientId,
        ServiceId: appointmentData.serviceId,
        LocationId: appointmentData.locationId,
        Status: appointmentData.status || 'Confirmed',
        UtcDateTime: utcTimestamp,
        SendClientEmailNotification: appointmentData.sendEmailNotification ?? true,
      }

      console.log('📋 IntakeQ appointment payload:')
      console.log(JSON.stringify(appointmentPayload, null, 2))

      const response = await this.makeRequest<IntakeQAppointmentResponse>('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentPayload),
      })

      const appointmentId = response.Id.toString()
      console.log(`✅ IntakeQ appointment created: ${appointmentId}`)

      return appointmentId
    } catch (error: any) {
      console.error('❌ Failed to create IntakeQ appointment:', error.message)
      throw error
    }
  }

  async createAppointment(appointmentData: {
    practitionerId: string
    clientFirstName: string
    clientLastName: string
    clientEmail: string
    clientPhone: string
    clientDateOfBirth?: string
    serviceId: string
    locationId: string
    dateTime: Date
    status?: 'Confirmed' | 'WaitingConfirmation'
    sendEmailNotification?: boolean
  }): Promise<string> {
    console.log('📅 Creating IntakeQ appointment...')

    try {
      // Step 1: Create or find client
      const clientData: IntakeQClient = {
        FirstName: appointmentData.clientFirstName,
        LastName: appointmentData.clientLastName,
        Email: appointmentData.clientEmail,
        Phone: appointmentData.clientPhone,
        DateOfBirth: appointmentData.clientDateOfBirth,
      }

      let clientId: string

      try {
        const clientResponse = await this.createClient(clientData)
        clientId = clientResponse.Id
      } catch (clientError: any) {
        // If client creation fails (might already exist), we'll need to handle this
        // For now, throw the error and handle gracefully in the calling code
        console.error('❌ Client creation failed:', clientError.message)
        throw new Error('Failed to create/find client in IntakeQ')
      }

      // Step 2: Create appointment using the new method
      return this.createAppointmentWithClient({
        clientId,
        practitionerId: appointmentData.practitionerId,
        serviceId: appointmentData.serviceId,
        locationId: appointmentData.locationId,
        dateTime: appointmentData.dateTime,
        status: appointmentData.status,
        sendEmailNotification: appointmentData.sendEmailNotification
      })
    } catch (error: any) {
      console.error('❌ Failed to create IntakeQ appointment:', error.message)
      throw error
    }
  }

  async getAppointment(appointmentId: string): Promise<IntakeQAppointmentResponse> {
    console.log(`🔍 Fetching IntakeQ appointment: ${appointmentId}`)
    
    try {
      const response = await this.makeRequest<IntakeQAppointmentResponse>(`/appointments/${appointmentId}`)
      return response
    } catch (error: any) {
      console.error('❌ Failed to fetch IntakeQ appointment:', error.message)
      throw error
    }
  }

  async getAppointmentsForDate(practitionerId: string, date: string): Promise<IntakeQAppointmentResponse[]> {
    console.log(`🔍 Fetching IntakeQ appointments for practitioner ${practitionerId} on ${date}`)
    
    try {
      // Use cache-first approach with automatic fetching
      return await intakeQCache.getOrFetch(
        practitionerId,
        date,
        async () => {
          console.log(`📡 Cache miss - fetching from IntakeQ API for ${practitionerId} on ${date}`)
          // IntakeQ API: Get all appointments and filter by practitioner and date
          // Note: IntakeQ doesn't have a practitioner-specific endpoint, so we get all and filter
          const response = await this.makeRequest<IntakeQAppointmentResponse[]>('/appointments')
      
      // Convert date to start/end of day timestamps for filtering
      const targetDate = new Date(date + 'T00:00:00.000Z') // Ensure proper UTC parsing
      const startOfDay = targetDate.getTime()
      const endOfDay = targetDate.getTime() + (24 * 60 * 60 * 1000 - 1) // End of day
      
      console.log(`🔍 Total appointments fetched: ${response.length}`)
      
      // Debug: Show all appointments for this practitioner (any date)
      const practitionerAppointments = response.filter(apt => apt.PractitionerId === practitionerId)
      console.log(`📊 Total appointments for practitioner ${practitionerId}: ${practitionerAppointments.length}`)
      
      if (practitionerAppointments.length > 0) {
        console.log('📋 Recent appointments for this practitioner:')
        practitionerAppointments.slice(0, 5).forEach(apt => {
          try {
            const aptDate = new Date(apt.StartDate).toISOString().split('T')[0]
            const aptTime = new Date(apt.StartDate).toISOString().split('T')[1].substring(0, 5)
            console.log(`   ${aptDate} ${aptTime} UTC - Status: ${apt.Status} (ID: ${apt.Id})`)
          } catch (dateError) {
            console.log(`   Invalid date: ${apt.StartDate} - Status: ${apt.Status} (ID: ${apt.Id})`)
          }
        })
      }
      
      // Filter appointments for the target practitioner and date
      const appointmentsForDate = response.filter(appointment => {
        const appointmentTime = appointment.StartDate
        const matchesPractitioner = appointment.PractitionerId === practitionerId
        const isOnTargetDate = appointmentTime >= startOfDay && appointmentTime <= endOfDay
        const isNotCancelled = appointment.Status !== 'Cancelled'
        
        return matchesPractitioner && isOnTargetDate && isNotCancelled
      })
      
      console.log(`📅 Found ${appointmentsForDate.length} appointments for practitioner ${practitionerId} on ${date}`)
      console.log(`🔍 Date range: ${startOfDay} to ${endOfDay}`)
      
          return appointmentsForDate
        },
        5 * 60 * 1000 // Cache for 5 minutes (shorter TTL for appointment data)
      )
      
    } catch (error: any) {
      console.error('❌ Failed to fetch IntakeQ appointments for date:', error.message)
      
      // Check if we have stale cache data as fallback
      const staleData = intakeQCache.get<IntakeQAppointmentResponse[]>(practitionerId, date)
      if (staleData) {
        console.log('⚡ Using stale cache data as fallback')
        return staleData
      }
      
      // Return empty array instead of throwing to allow availability check to continue
      console.log('⚠️ Continuing without IntakeQ conflict checking due to API error')
      return []
    }
  }

  /**
   * Reschedule an appointment in IntakeQ
   */
  async rescheduleAppointment(appointmentId: string, newDateTime: {
    startTime: string // ISO format
    endTime: string // ISO format
    reason?: string
  }): Promise<{ success: boolean; appointmentId: string }> {
    try {
      console.log(`🔄 Rescheduling IntakeQ appointment ${appointmentId} to ${newDateTime.startTime}...`)

      const startDate = new Date(newDateTime.startTime).getTime()
      const endDate = new Date(newDateTime.endTime).getTime()

      const updateData = {
        StartDate: startDate,
        EndDate: endDate,
        StartDateIso: newDateTime.startTime,
        EndDateIso: newDateTime.endTime
      }

      await this.makeRequest<void>(`/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      console.log(`✅ IntakeQ appointment ${appointmentId} rescheduled successfully`)

      return {
        success: true,
        appointmentId
      }

    } catch (error) {
      console.error(`❌ Error rescheduling IntakeQ appointment ${appointmentId}:`, error)
      throw error
    }
  }

  /**
   * Get video link for IntakeQ appointment
   */
  async getVideoLink(appointmentId: string): Promise<{
    patientUrl?: string
    providerUrl?: string
    waitingRoomUrl?: string
    sessionId?: string
    expiresAt?: string
  }> {
    try {
      console.log(`📹 Fetching video link for IntakeQ appointment ${appointmentId}...`)

      // IntakeQ uses embedded video in their platform
      // Video links are typically generated dynamically
      const response = await this.makeRequest<any>(`/appointments/${appointmentId}/video`)
      
      const videoData = response || {}
      
      console.log(`✅ Video link retrieved for IntakeQ appointment ${appointmentId}`)

      return {
        patientUrl: videoData.PatientVideoUrl || videoData.patientUrl,
        providerUrl: videoData.ProviderVideoUrl || videoData.providerUrl,
        waitingRoomUrl: videoData.WaitingRoomUrl || videoData.waitingRoomUrl,
        sessionId: videoData.SessionId || videoData.sessionId,
        expiresAt: videoData.ExpiresAt || videoData.expiresAt
      }

    } catch (error) {
      console.error(`❌ Error fetching video link for IntakeQ appointment ${appointmentId}:`, error)
      
      // IntakeQ might not have dedicated video API - return platform URLs
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('404'))) {
        console.log('⚠️ Using IntakeQ platform video links as fallback')
        
        return {
          patientUrl: `https://intakeq.com/booking/${appointmentId}/video/patient`,
          providerUrl: `https://intakeq.com/admin/appointments/${appointmentId}/video`,
          waitingRoomUrl: `https://intakeq.com/booking/${appointmentId}/waiting-room`,
          sessionId: `intakeq_${appointmentId}_${Date.now()}`,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours from now
        }
      }
      
      throw error
    }
  }

  async updateAppointmentStatus(appointmentId: string, status: 'Confirmed' | 'Cancelled' | 'NoShow'): Promise<void> {
    console.log(`🔄 Updating IntakeQ appointment ${appointmentId} status to: ${status}`)

    try {
      await this.makeRequest(`/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({ Status: status }),
      })

      console.log(`✅ IntakeQ appointment ${appointmentId} status updated`)
    } catch (error: any) {
      console.error('❌ Failed to update IntakeQ appointment status:', error.message)
      throw error
    }
  }

  async updateClientInsurance(clientId: string, insuranceData: {
    PrimaryInsuranceName: string
    PrimaryMemberID: string
    PrimaryGroupNumber?: string
    PrimaryPolicyHolderName?: string
    PrimaryPolicyHolderDOB?: string
  }): Promise<void> {
    console.log(`🔄 Updating insurance for IntakeQ client ${clientId}...`)

    try {
      await this.makeRequest(`/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify(insuranceData),
      })

      console.log(`✅ IntakeQ client ${clientId} insurance updated`)
    } catch (error: any) {
      console.error('❌ Failed to update IntakeQ client insurance:', error.message)
      throw error
    }
  }

  // Test connection method
  async testConnection(): Promise<boolean> {
    console.log('🔧 Testing IntakeQ connection...')
    
    try {
      // Try to make a simple request to verify API key works
      // Since we don't have a specific "test" endpoint, we'll try to get practitioners
      await this.makeRequest('/practitioners')
      console.log('✅ IntakeQ connection successful')
      return true
    } catch (error: any) {
      console.error('❌ IntakeQ connection failed:', error.message)
      return false
    }
  }

  // Enhanced rate limit status including production limiter
  getRateLimitStatus(): {
    requestsThisMinute: number
    requestsToday: number
    rateLimiter: {
      tokens: number
      maxTokens: number
      queueLength: number
      activeRequests: number
      isProcessing: boolean
    }
    cache: {
      size: number
      totalEntries: number
      expiredEntries: number
    }
  } {
    return {
      requestsThisMinute: this.requestCount,
      requestsToday: this.dailyRequestCount,
      rateLimiter: intakeQRateLimiter.getStatus(),
      cache: intakeQCache.getStats()
    }
  }

  // List available services from IntakeQ
  async listServices(): Promise<any[]> {
    try {
      const response = await fetch('https://intakeq.com/api/v1/services', {
        method: 'GET',
        headers: {
          'X-Auth-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`IntakeQ API error: ${response.status} ${response.statusText}`)
      }

      const services = await response.json()
      console.log(`✅ Fetched ${Array.isArray(services) ? services.length : 0} services from IntakeQ`)
      return Array.isArray(services) ? services : []
    } catch (error: any) {
      console.error('❌ Failed to fetch IntakeQ services:', error.message)
      throw error
    }
  }

  // Get booking settings (locations, services, practitioners)
  async getBookingSettings(): Promise<{
    locations: Array<{Id: string, Name: string}>
    services: Array<{Id: string, Name: string, Duration: number, Price: number}>
    practitioners: Array<{Id: string, Name: string, Email: string}>
  }> {
    try {
      const response = await this.makeRequest<any>('/appointments/settings', {
        method: 'GET'
      })

      console.log(`✅ Fetched IntakeQ booking settings:`, {
        locations: response.Locations?.length || 0,
        services: response.Services?.length || 0,
        practitioners: response.Practitioners?.length || 0
      })

      return {
        locations: response.Locations || [],
        services: response.Services || [],
        practitioners: response.Practitioners || []
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch IntakeQ booking settings:', error.message)
      throw error
    }
  }

  // Send intake questionnaire to client
  async sendQuestionnaire(params: {
    questionnaireId: string
    clientName: string
    clientEmail: string
    practitionerId?: string
    clientPhone?: string
  }): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`📋 Sending intake questionnaire ${params.questionnaireId} to ${params.clientEmail}...`)

      const payload: any = {
        QuestionnaireId: params.questionnaireId,
        ClientName: params.clientName,
        ClientEmail: params.clientEmail
      }

      if (params.practitionerId) {
        payload.PractitionerId = params.practitionerId
      }

      if (params.clientPhone) {
        payload.ClientPhone = params.clientPhone
      }

      await this.makeRequest<void>('/intakes/send', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      console.log(`✅ Intake questionnaire sent successfully to ${params.clientEmail}`)

      return {
        success: true,
        message: 'Questionnaire sent successfully'
      }
    } catch (error: any) {
      console.error('❌ Failed to send questionnaire:', error.message)
      throw error
    }
  }
}

// Create and export singleton instance
export const intakeQService = new IntakeQService()
export default intakeQService
// src/lib/services/athenaService.ts
import { supabase } from '@/lib/supabase'

interface AthenaToken {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface AthenaProvider {
  providerid: string
  firstname: string
  lastname: string
  npi?: string
  specialty?: string
  departmentlist?: Array<{
    departmentid: string
    name: string
  }>
}

interface AthenaAppointment {
  appointmentid: string
  date: string
  starttime: string
  endtime: string
  appointmenttype: string
  providerid: string
  departmentid: string
  patientid?: string
  status: string
}

interface AppointmentBookingData {
  providerId: string
  departmentId: string
  appointmentType: string
  date: string
  startTime: string
  patientFirstName: string
  patientLastName: string
  patientPhone: string
  patientEmail: string
  reason?: string
}

class AthenaService {
  private baseUrl: string
  private tokenUrl: string
  private clientId: string
  private clientSecret: string
  private practiceId: string
  private token: string | null = null
  private tokenExpiry: Date | null = null
  private requestsPerSecond: number
  private maxRetries: number
  private isEnabled: boolean = false

  constructor() {
    this.baseUrl = process.env.ATHENA_BASE_URL!
    this.tokenUrl = process.env.ATHENA_TOKEN_URL!
    this.clientId = process.env.ATHENA_CLIENT_ID!
    this.clientSecret = process.env.ATHENA_CLIENT_SECRET!
    this.practiceId = process.env.ATHENA_PRACTICE_ID || '3409601'
    this.requestsPerSecond = parseInt(process.env.ATHENA_REQUESTS_PER_SECOND || '5')
    this.maxRetries = parseInt(process.env.ATHENA_MAX_RETRIES || '3')

    const hasRequiredCredentials = this.baseUrl && this.tokenUrl && this.clientId && this.clientSecret
    
    if (!hasRequiredCredentials) {
      console.log('⚠️ Athena credentials not configured - Athena features disabled')
      this.isEnabled = false
    } else {
      console.log('🏥 Athena Service initialized for practice:', this.practiceId)
      this.isEnabled = true
    }
  }

  /**
   * Get OAuth2 access token from Athena
   */
  private async getToken(): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('Athena service not enabled')
    }
    
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token
    }

    console.log('🔑 Getting new Athena access token...')

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials&scope=athena/service/Athenanet.MDP.*'
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Athena auth failed: ${response.status} ${errorText}`)
      }

      const tokenData: AthenaToken = await response.json()
      
      this.token = tokenData.access_token
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000) - 60000) // 1 min buffer
      
      console.log('✅ Athena token obtained, expires:', this.tokenExpiry.toISOString())
      
      return this.token

    } catch (error) {
      console.error('❌ Athena authentication error:', error)
      throw error
    }
  }

  /**
   * Make authenticated request to Athena API with rate limiting and retries
   */
  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}, 
    retryCount = 0
  ): Promise<any> {
    try {
      const token = await this.getToken()
      const url = `${this.baseUrl}/v1/${this.practiceId}${endpoint}`

      console.log(`🌐 Athena API request: ${options.method || 'GET'} ${endpoint}`)

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5')
        console.log(`⏳ Rate limited, waiting ${retryAfter}s...`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        
        if (retryCount < this.maxRetries) {
          return this.makeRequest(endpoint, options, retryCount + 1)
        }
        throw new Error('Max retries exceeded due to rate limiting')
      }

      // Handle token expiration
      if (response.status === 401) {
        console.log('🔄 Token expired, refreshing...')
        this.token = null
        this.tokenExpiry = null
        
        if (retryCount < this.maxRetries) {
          return this.makeRequest(endpoint, options, retryCount + 1)
        }
        throw new Error('Authentication failed after retries')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Athena API error: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      
      // Rate limiting - wait between requests
      if (this.requestsPerSecond > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 / this.requestsPerSecond))
      }

      return data

    } catch (error) {
      console.error(`❌ Athena API request failed: ${endpoint}`, error)
      throw error
    }
  }

  /**
   * Test the connection to Athena API
   */
  async testConnection(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Athena service not enabled - missing credentials' }
    }
    
    try {
      console.log('🧪 Testing Athena API connection...')
      
      const data = await this.makeRequest('/providers')
      
      return {
        success: true,
        data: {
          providers_found: data?.providers?.length || 0,
          practice_id: this.practiceId,
          environment: process.env.ATHENA_ENVIRONMENT || 'sandbox'
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Fetch all providers from Athena
   */
  async getProviders(): Promise<AthenaProvider[]> {
    if (!this.isEnabled) {
      console.log('⚠️ Athena service disabled - returning empty provider list')
      return []
    }
    
    try {
      console.log('👥 Fetching providers from Athena...')
      
      const data = await this.makeRequest('/providers')
      const providers = data?.providers || []
      
      console.log(`✅ Found ${providers.length} providers in Athena`)
      
      return providers
    } catch (error) {
      console.error('❌ Error fetching providers from Athena:', error)
      throw error
    }
  }

  /**
   * Sync providers from Athena to Supabase
   */
  async syncProviders(): Promise<{ synced: number; errors: number }> {
    try {
      console.log('🔄 Syncing providers from Athena to Supabase...')
      
      const athenaProviders = await this.getProviders()
      let synced = 0
      let errors = 0

      for (const provider of athenaProviders) {
        try {
          // Check if provider already exists in Supabase
          const { data: existing } = await supabase
            .from('providers')
            .select('id, athena_provider_id')
            .eq('athena_provider_id', provider.providerid)
            .single()

          const providerData = {
            athena_provider_id: provider.providerid,
            first_name: provider.firstname,
            last_name: provider.lastname,
            npi: provider.npi || null,
            specialty: provider.specialty || null,
            is_active: true,
            accepts_new_patients: true,
            telehealth_enabled: false,
            updated_at: new Date().toISOString()
          }

          if (existing) {
            // Update existing provider
            const { error } = await supabase
              .from('providers')
              .update(providerData)
              .eq('id', existing.id)

            if (error) throw error
            console.log(`✅ Updated provider: ${provider.firstname} ${provider.lastname}`)
          } else {
            // Insert new provider
            const { error } = await supabase
              .from('providers')
              .insert({
                ...providerData,
                created_at: new Date().toISOString()
              })

            if (error) throw error
            console.log(`✅ Added new provider: ${provider.firstname} ${provider.lastname}`)
          }

          synced++

        } catch (error) {
          console.error(`❌ Error syncing provider ${provider.firstname} ${provider.lastname}:`, error)
          errors++
        }
      }

      console.log(`🎉 Provider sync complete: ${synced} synced, ${errors} errors`)
      
      return { synced, errors }

    } catch (error) {
      console.error('❌ Provider sync failed:', error)
      throw error
    }
  }

  /**
   * Get available appointment slots for a provider
   */
  async getProviderAvailability(
    providerId: string, 
    departmentId: string, 
    date: string
  ): Promise<any> {
    try {
      const endpoint = `/providers/${providerId}/appointments/open?departmentid=${departmentId}&date=${date}`
      const data = await this.makeRequest(endpoint)
      
      return data?.appointments || []
    } catch (error) {
      console.error(`❌ Error fetching availability for provider ${providerId}:`, error)
      throw error
    }
  }

  /**
   * Create an appointment in Athena
   */
  async createAppointment(bookingData: AppointmentBookingData): Promise<string> {
    try {
      console.log('📅 Creating appointment in Athena...', bookingData)

      // First, create or find the patient
      const patientId = await this.createOrFindPatient({
        firstname: bookingData.patientFirstName,
        lastname: bookingData.patientLastName,
        mobilephone: bookingData.patientPhone,
        email: bookingData.patientEmail
      })

      // Create the appointment
      const appointmentData = {
        appointmentdate: bookingData.date,
        appointmenttime: bookingData.startTime,
        appointmenttype: bookingData.appointmentType,
        departmentid: bookingData.departmentId,
        providerid: bookingData.providerId,
        patientid: patientId,
        reasonforvisit: bookingData.reason || 'Scheduled appointment'
      }

      const response = await this.makeRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData)
      })

      const appointmentId = response?.appointmentid
      console.log(`✅ Appointment created in Athena: ${appointmentId}`)

      return appointmentId

    } catch (error) {
      console.error('❌ Error creating appointment in Athena:', error)
      throw error
    }
  }

  /**
   * Create or find a patient in Athena
   */
  private async createOrFindPatient(patientData: {
    firstname: string
    lastname: string
    mobilephone: string
    email: string
  }): Promise<string> {
    try {
      // Try to find existing patient by phone or email
      const searchResponse = await this.makeRequest(
        `/patients/search?firstname=${patientData.firstname}&lastname=${patientData.lastname}`
      )

      const existingPatients = searchResponse?.patients || []
      
      // Look for exact match by phone or email
      const exactMatch = existingPatients.find((p: any) => 
        p.mobilephone === patientData.mobilephone || 
        p.email === patientData.email
      )

      if (exactMatch) {
        console.log(`✅ Found existing patient: ${exactMatch.patientid}`)
        return exactMatch.patientid
      }

      // Create new patient
      console.log('👤 Creating new patient in Athena...')
      
      const createResponse = await this.makeRequest('/patients', {
        method: 'POST',
        body: JSON.stringify({
          ...patientData,
          dob: '1990-01-01', // Default DOB - should be collected in real implementation
          sex: 'U' // Unknown - should be collected in real implementation
        })
      })

      const patientId = createResponse?.patientid
      console.log(`✅ New patient created: ${patientId}`)

      return patientId

    } catch (error) {
      console.error('❌ Error creating/finding patient:', error)
      throw error
    }
  }

  /**
   * Reschedule an appointment in Athena
   */
  async rescheduleAppointment(appointmentId: string, newDateTime: {
    date: string // YYYY-MM-DD format
    startTime: string // HH:MM format
    endTime?: string // HH:MM format (optional)
    reason?: string
  }): Promise<{ success: boolean; appointmentId: string }> {
    try {
      console.log(`🔄 Rescheduling appointment ${appointmentId} to ${newDateTime.date} ${newDateTime.startTime}...`)

      // Get current appointment details first
      const currentAppointment = await this.getAppointment(appointmentId)
      if (!currentAppointment) {
        throw new Error('Appointment not found')
      }

      // Update the appointment with new date/time
      const updateData: any = {
        appointmentdate: newDateTime.date,
        appointmenttime: newDateTime.startTime
      }

      // Add end time if provided
      if (newDateTime.endTime) {
        updateData.duration = calculateDurationMinutes(newDateTime.startTime, newDateTime.endTime)
      }

      // Add reason to notes if provided
      if (newDateTime.reason) {
        updateData.note = `Rescheduled: ${newDateTime.reason}`
      }

      const response = await this.makeRequest(`/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      console.log(`✅ Appointment ${appointmentId} rescheduled successfully`)

      return {
        success: true,
        appointmentId: response?.appointmentid || appointmentId
      }

    } catch (error) {
      console.error(`❌ Error rescheduling appointment ${appointmentId}:`, error)
      throw error
    }
  }

  /**
   * Get video link for appointment from Athena
   */
  async getVideoLink(appointmentId: string): Promise<{
    patientUrl?: string
    providerUrl?: string 
    waitingRoomUrl?: string
    sessionId?: string
    expiresAt?: string
  }> {
    try {
      console.log(`📹 Fetching video link for appointment ${appointmentId}...`)

      // Athena video conferencing endpoint (if available)
      const response = await this.makeRequest(`/appointments/${appointmentId}/videoconference`)
      
      const videoData = response?.videoconference || {}
      
      console.log(`✅ Video link retrieved for appointment ${appointmentId}`)

      return {
        patientUrl: videoData.patienturl,
        providerUrl: videoData.providerurl,
        waitingRoomUrl: videoData.waitingroomurl,
        sessionId: videoData.sessionid,
        expiresAt: videoData.expiresat
      }

    } catch (error) {
      console.error(`❌ Error fetching video link for appointment ${appointmentId}:`, error)
      
      // Return fallback/empty response if video conferencing not available
      if (error instanceof Error && error.message.includes('not found')) {
        console.log('⚠️ Video conferencing not configured for this appointment')
        return {}
      }
      
      throw error
    }
  }

  /**
   * Cancel an appointment in Athena
   */
  async cancelAppointment(appointmentId: string, reason: string = 'Patient requested cancellation'): Promise<void> {
    try {
      console.log(`🚫 Cancelling appointment ${appointmentId}...`)

      await this.makeRequest(`/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          appointmentstatus: 'x', // 'x' means cancelled in Athena
          cancellationreason: reason
        })
      })

      console.log(`✅ Appointment ${appointmentId} cancelled`)

    } catch (error) {
      console.error(`❌ Error cancelling appointment ${appointmentId}:`, error)
      throw error
    }
  }

  /**
   * Get appointment details from Athena
   */
  async getAppointment(appointmentId: string): Promise<AthenaAppointment | null> {
    try {
      const data = await this.makeRequest(`/appointments/${appointmentId}`)
      return data?.appointment || null
    } catch (error) {
      console.error(`❌ Error fetching appointment ${appointmentId}:`, error)
      return null
    }
  }
}

// Helper function to calculate duration in minutes
function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return endMinutes - startMinutes
}

// Export singleton instance
export const athenaService = new AthenaService()
export default athenaService
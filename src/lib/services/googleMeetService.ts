/**
 * Google Meet Service
 *
 * Generates Google Meet links for telehealth appointments
 * Uses Google Meet REST API to create persistent meeting spaces
 *
 * Requirements:
 * - Google Workspace account with Meet API enabled
 * - Service account with domain-wide delegation
 * - Meeting spaces are persistent (can be reused for same appointment)
 */

import { SpacesServiceClient } from '@google-apps/meet'
import { GoogleAuth } from 'google-auth-library'

class GoogleMeetService {
  private client: SpacesServiceClient | null = null
  private auth: GoogleAuth | null = null
  private isInitialized = false
  private initError: string | null = null

  constructor() {
    // Initialize on first use
  }

  /**
   * Initialize the Google Meet client
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initError) {
      throw new Error(`Google Meet Service initialization failed: ${this.initError}`)
    }

    try {
      // Get service account credentials from environment
      const serviceAccountKeyBase64 = process.env.GOOGLE_MEET_SERVICE_ACCOUNT_KEY
      const impersonateEmail = process.env.GOOGLE_MEET_IMPERSONATE_EMAIL
      const domain = process.env.GOOGLE_WORKSPACE_DOMAIN

      if (!serviceAccountKeyBase64) {
        this.initError = 'GOOGLE_MEET_SERVICE_ACCOUNT_KEY environment variable not set'
        throw new Error(this.initError)
      }

      if (!impersonateEmail) {
        this.initError = 'GOOGLE_MEET_IMPERSONATE_EMAIL environment variable not set'
        throw new Error(this.initError)
      }

      // Decode base64 service account key
      let serviceAccountKey
      try {
        const keyJson = Buffer.from(serviceAccountKeyBase64, 'base64').toString('utf-8')
        serviceAccountKey = JSON.parse(keyJson)
      } catch (error) {
        this.initError = 'Invalid service account key format. Ensure it is base64 encoded JSON.'
        throw new Error(this.initError)
      }

      // Create GoogleAuth instance with domain-wide delegation
      this.auth = new GoogleAuth({
        credentials: serviceAccountKey,
        scopes: [
          'https://www.googleapis.com/auth/meetings.space.created',
          'https://www.googleapis.com/auth/meetings.space.readonly'
        ],
        clientOptions: {
          subject: impersonateEmail // Impersonate this user for domain-wide delegation
        }
      })

      // Create Meet client
      const authClient = await this.auth.getClient()
      this.client = new SpacesServiceClient({
        authClient: authClient as any
      })

      this.isInitialized = true
      console.log('✅ Google Meet Service initialized successfully')
      console.log(`   Impersonating: ${impersonateEmail}`)
      console.log(`   Domain: ${domain}`)

    } catch (error: any) {
      console.error('❌ Failed to initialize Google Meet Service:', error.message)
      this.initError = error.message
      throw error
    }
  }

  /**
   * Generate a persistent Google Meet link for an appointment
   *
   * NOTE: All meetings are created as OPEN access (anyone with link can join).
   * This allows providers to use their personal Google accounts and patients
   * to join without any account. The meeting is organized by hello@trymoonlit.com
   * but accessible to everyone with the link.
   *
   * @param appointmentId - Unique identifier for the appointment
   * @param patientName - Name of the patient (for meeting title)
   * @param providerName - Name of the provider
   * @param appointmentTime - Start time of the appointment
   * @returns Google Meet URL or null if creation fails
   */
  async generateMeetingLink(
    appointmentId: string,
    patientName: string,
    providerName: string,
    appointmentTime: Date
  ): Promise<string | null> {
    try {
      await this.initialize()

      if (!this.client) {
        throw new Error('Google Meet client not initialized')
      }

      console.log(`🔗 Generating Google Meet link for appointment ${appointmentId}`)

      // Format appointment time for meeting name
      const timeStr = appointmentTime.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })

      // Create a meeting space
      // Note: The Meet API doesn't allow custom meeting codes,
      // so we get a randomly generated one
      const [space] = await this.client.createSpace({
        space: {
          config: {
            accessType: 'OPEN', // Anyone with link can join (providers + patients)
            entryPointAccess: 'ALL', // Allow joining from any device
          }
        }
      })

      if (!space.meetingUri) {
        throw new Error('Meeting space created but no URI returned')
      }

      console.log(`✅ Google Meet link created: ${space.meetingUri}`)
      console.log(`   Space ID: ${space.name}`)
      console.log(`   Meeting Code: ${space.meetingCode}`)

      // Store the space ID for future reference if needed
      // You might want to store this in the database alongside the meeting URL
      // to manage the space later (e.g., update settings, end meeting, etc.)

      return space.meetingUri

    } catch (error: any) {
      console.error(`❌ Failed to generate Google Meet link for appointment ${appointmentId}:`, error.message)

      // Log more details for debugging
      if (error.code === 403) {
        console.error('   Permission denied. Ensure:')
        console.error('   1. Google Meet REST API is enabled in Google Cloud Console')
        console.error('   2. Service account has domain-wide delegation')
        console.error('   3. Required scopes are granted in Google Workspace Admin')
      } else if (error.code === 401) {
        console.error('   Authentication failed. Check service account credentials.')
      }

      return null
    }
  }

  /**
   * Get meeting details for an existing space
   *
   * @param spaceId - The space ID (from the meeting URI)
   * @returns Space details or null if not found
   */
  async getMeetingSpace(spaceId: string): Promise<any | null> {
    try {
      await this.initialize()

      if (!this.client) {
        throw new Error('Google Meet client not initialized')
      }

      const [space] = await this.client.getSpace({
        name: spaceId
      })

      return space

    } catch (error: any) {
      console.error(`❌ Failed to get meeting space ${spaceId}:`, error.message)
      return null
    }
  }

  /**
   * Update meeting space configuration
   *
   * @param spaceId - The space ID to update
   * @param config - New configuration
   * @returns Updated space or null if failed
   */
  async updateMeetingSpace(spaceId: string, config: any): Promise<any | null> {
    try {
      await this.initialize()

      if (!this.client) {
        throw new Error('Google Meet client not initialized')
      }

      const [space] = await this.client.updateSpace({
        space: {
          name: spaceId,
          config: config
        },
        updateMask: {
          paths: ['config']
        }
      })

      return space

    } catch (error: any) {
      console.error(`❌ Failed to update meeting space ${spaceId}:`, error.message)
      return null
    }
  }

  /**
   * End (delete) a meeting space
   * Note: This will kick out all participants and end the meeting
   *
   * @param spaceId - The space ID to end
   * @returns true if successful
   */
  async endMeetingSpace(spaceId: string): Promise<boolean> {
    try {
      await this.initialize()

      if (!this.client) {
        throw new Error('Google Meet client not initialized')
      }

      await this.client.endActiveConference({
        name: `${spaceId}/activeConference`
      })

      console.log(`✅ Ended meeting space ${spaceId}`)
      return true

    } catch (error: any) {
      // 404 means the meeting wasn't active, which is fine
      if (error.code === 404) {
        console.log(`ℹ️ Meeting space ${spaceId} was not active`)
        return true
      }

      console.error(`❌ Failed to end meeting space ${spaceId}:`, error.message)
      return false
    }
  }

  /**
   * Check if the service is properly configured
   */
  async checkConfiguration(): Promise<{
    configured: boolean
    message: string
    details?: any
  }> {
    try {
      await this.initialize()

      return {
        configured: true,
        message: 'Google Meet Service is properly configured',
        details: {
          domain: process.env.GOOGLE_WORKSPACE_DOMAIN,
          impersonateEmail: process.env.GOOGLE_MEET_IMPERSONATE_EMAIL,
          hasServiceAccount: !!process.env.GOOGLE_MEET_SERVICE_ACCOUNT_KEY
        }
      }

    } catch (error: any) {
      return {
        configured: false,
        message: error.message,
        details: {
          domain: process.env.GOOGLE_WORKSPACE_DOMAIN,
          impersonateEmail: process.env.GOOGLE_MEET_IMPERSONATE_EMAIL,
          hasServiceAccount: !!process.env.GOOGLE_MEET_SERVICE_ACCOUNT_KEY
        }
      }
    }
  }
}

// Export singleton instance
export const googleMeetService = new GoogleMeetService()
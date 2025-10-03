// src/lib/services/ProviderService.ts
import { supabase as supabaseClient } from '@/lib/supabase'
import { Provider } from '@/types/database'

export interface ProviderWithAvailability extends Provider {
  isAvailable: boolean
  availabilityReason?: string
}

export interface AppointmentProviders {
  billingProvider?: Provider  // Dr. Privratsky for supervised appointments
  renderingProvider: Provider  // The actual treating provider
  isSupervised: boolean
  networkStatus: 'in-network' | 'supervised' | 'out-of-network'
}

export class ProviderService {
  private supabase = supabaseClient
  
  // Dr. Privratsky's ID - the attending physician for supervised care
  private readonly ATTENDING_PROVIDER_ID = 'NEED_TO_GET_FROM_DB' // We'll populate this dynamically

  /**
   * Get all providers available for a specific payer based on credentialing logic
   */
  async getAvailableProviders(payer: Payer): Promise<ProviderWithAvailability[]> {
    try {
      if (payer.requires_attending) {
        // Supervised care - ALL residents available
        return await this.getAllResidents()
      } else {
        // Independent care - only credentialed providers
        return await this.getCredentialedProviders(payer.id)
      }
    } catch (error) {
      console.error('ProviderService.getAvailableProviders error:', error)
      return []
    }
  }

  /**
   * Get all psychiatry residents for supervised appointments
   */
  async getAllResidents(): Promise<ProviderWithAvailability[]> {
    try {
      const { data: residents, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('role', 'psychiatry resident')
        .eq('accepts_new_patients', true)
        .order('first_name')

      if (error) {
        console.error('Error getting residents:', error)
        return []
      }

      if (!residents) {
        return []
      }

      return residents.map(resident => ({
        ...resident,
        isAvailable: true,
        availabilityReason: 'Available for supervised appointments'
      }))
    } catch (error) {
      console.error('ProviderService.getAllResidents error:', error)
      return []
    }
  }

  /**
   * Get providers credentialed with specific payer for independent appointments
   */
  async getCredentialedProviders(payerId: string): Promise<ProviderWithAvailability[]> {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Query provider_payer_networks to find credentialed providers
      const { data: networks, error: networkError } = await this.supabase
        .from('provider_payer_networks')
        .select(`
          provider_id,
          effective_date,
          expiration_date,
          status,
          providers (*)
        `)
        .eq('payer_id', payerId)
        .eq('status', 'active')
        .lte('effective_date', today)
        .or(`expiration_date.is.null,expiration_date.gt.${today}`)

      if (networkError) {
        console.error('Error getting credentialed providers:', networkError)
        return []
      }

      if (!networks) {
        return []
      }

      return networks
        .filter(network => network.providers) // Ensure provider data exists
        .map(network => ({
          ...network.providers,
          isAvailable: true,
          availabilityReason: 'Credentialed for independent practice'
        })) as ProviderWithAvailability[]

    } catch (error) {
      console.error('ProviderService.getCredentialedProviders error:', error)
      return []
    }
  }

  /**
   * Get the attending physician (Dr. Privratsky)
   */
  async getAttendingPhysician(): Promise<Provider | null> {
    try {
      const { data: attending, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('role', 'psychiatrist')
        .single()

      if (error) {
        console.error('Error getting attending physician:', error)
        return null
      }

      return attending
    } catch (error) {
      console.error('ProviderService.getAttendingPhysician error:', error)
      return null
    }
  }

  /**
   * Determine appointment provider structure based on payer requirements
   */
  async getAppointmentProviders(
    selectedProvider: Provider, 
    payer: Payer
  ): Promise<AppointmentProviders> {
    try {
      if (payer.requires_attending) {
        // Supervised appointment
        const attending = await this.getAttendingPhysician()
        
        return {
          billingProvider: attending || undefined,
          renderingProvider: selectedProvider,
          isSupervised: true,
          networkStatus: 'supervised'
        }
      } else {
        // Independent appointment
        return {
          renderingProvider: selectedProvider,
          isSupervised: false,
          networkStatus: 'in-network'
        }
      }
    } catch (error) {
      console.error('ProviderService.getAppointmentProviders error:', error)
      return {
        renderingProvider: selectedProvider,
        isSupervised: false,
        networkStatus: 'out-of-network'
      }
    }
  }

  /**
   * Check if a specific provider is credentialed with a payer
   */
  async isProviderCredentialed(providerId: string, payerId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data: network, error } = await this.supabase
        .from('provider_payer_networks')
        .select('*')
        .eq('provider_id', providerId)
        .eq('payer_id', payerId)
        .eq('status', 'active')
        .lte('effective_date', today)
        .or(`expiration_date.is.null,expiration_date.gt.${today}`)
        .single()

      return !error && network !== null
    } catch (error) {
      console.error('ProviderService.isProviderCredentialed error:', error)
      return false
    }
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<Provider | null> {
    try {
      const { data: provider, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error getting provider by ID:', error)
        return null
      }

      return provider
    } catch (error) {
      console.error('ProviderService.getProviderById error:', error)
      return null
    }
  }

  /**
   * Get all providers (for admin purposes)
   */
  async getAllProviders(): Promise<Provider[]> {
    try {
      const { data: providers, error } = await this.supabase
        .from('providers')
        .select('*')
        .order('first_name')

      if (error) {
        console.error('Error getting all providers:', error)
        return []
      }

      return providers || []
    } catch (error) {
      console.error('ProviderService.getAllProviders error:', error)
      return []
    }
  }

  /**
   * Get provider's full name
   */
  getProviderFullName(provider: Provider): string {
    const first = provider.first_name || ''
    const last = provider.last_name || ''
    return `${first} ${last}`.trim()
  }

  /**
   * Get provider's display title
   */
  getProviderDisplayTitle(provider: Provider): string {
    const name = this.getProviderFullName(provider)
    const title = provider.title || ''
    
    if (title) {
      return `${name}, ${title}`
    }
    
    return name
  }

  /**
   * Check if provider accepts new patients
   */
  isAcceptingNewPatients(provider: Provider): boolean {
    return provider.accepts_new_patients || false
  }

  /**
   * Check if provider offers telehealth
   */
  offersTelehealth(provider: Provider): boolean {
    return provider.telehealth_enabled || false
  }

  /**
   * Get provider's booking buffer time
   */
  getBookingBuffer(provider: Provider): number {
    return provider.booking_buffer_minutes || 15
  }

  /**
   * Get provider's max daily appointments
   */
  getMaxDailyAppointments(provider: Provider): number {
    return provider.max_daily_appointments || 8
  }
}

// Export singleton instance
export const providerService = new ProviderService()
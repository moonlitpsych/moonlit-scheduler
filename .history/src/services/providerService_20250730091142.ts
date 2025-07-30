import { supabase } from '@/lib/supabase'
import { Provider } from '@/types/database'

export class ProviderService {
    /**
     * Get available providers based on booking criteria
     */
    static async getAvailableProviders(criteria: {
        acceptsNewPatients?: boolean
        telehealthEnabled?: boolean
        languageSpoken?: string
        payerId?: string
    }): Promise<Provider[]> {
        try {
            let query = supabase
                .from('providers')
                .select(`
          id, first_name, last_name, title, profile_image_url,
          languages_spoken, telehealth_enabled, accepts_new_patients,
          booking_buffer_minutes, max_daily_appointments
        `)

            if (criteria.acceptsNewPatients !== undefined) {
                query = query.eq('accepts_new_patients', criteria.acceptsNewPatients)
            }

            if (criteria.telehealthEnabled !== undefined) {
                query = query.eq('telehealth_enabled', criteria.telehealthEnabled)
            }

            if (criteria.languageSpoken) {
                query = query.contains('languages_spoken', [criteria.languageSpoken])
            }

            // TODO: Add payer-provider relationship filtering based on criteria.payerId

            const { data, error } = await query

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching available providers:', error)
            return []
        }
    }

    /**
     * Get provider by ID with full details
     */
    static async getProviderById(id: string): Promise<Provider | null> {
        try {
            const { data, error } = await supabase
                .from('providers')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error fetching provider:', error)
            return null
        }
    }
}
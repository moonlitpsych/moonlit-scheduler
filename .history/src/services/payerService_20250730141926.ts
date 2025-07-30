import { supabase } from '@/lib/supabase'
import { Payer } from '@/types/database'

export class PayerService {
    /**
     * Search for payers by name with fuzzy matching
     */
    static async searchPayers(query: string): Promise<Payer[]> {
        try {
            const { data, error } = await supabase
                .from('payers')
                .select('*')
                .ilike('name', `%${query}%`)
                .order('name')
                .limit(10)

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error searching payers:', error)
            return []
        }
    }

    // Add this method to your existing PayerService class in src/services/payerService.ts

    /**
     * Check payer acceptance status based on effective dates
     */
    static checkAcceptanceStatus(payer: Payer): {
        status: 'not-accepted' | 'future' | 'active'
        effectiveDate?: Date
        daysUntilActive?: number
    } {
        const now = new Date()
        const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
        const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null

        // Not accepted if no dates at all
        if (!effectiveDate && !projectedDate) {
            return { status: 'not-accepted' }
        }

        // Active if effective date is in the past
        if (effectiveDate && effectiveDate <= now) {
            return { status: 'active', effectiveDate }
        }

        // Future if effective date is more than 30 days away
        if (effectiveDate) {
            const daysUntilActive = Math.ceil((effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            return {
                status: daysUntilActive > 30 ? 'not-accepted' : 'future',
                effectiveDate,
                daysUntilActive
            }
        }

        // Use projected date if no effective date
        if (projectedDate) {
            const daysUntilActive = Math.ceil((projectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            return {
                status: daysUntilActive > 30 ? 'not-accepted' : 'future',
                effectiveDate: projectedDate,
                daysUntilActive
            }
        }

        return { status: 'not-accepted' }
    }

    /**
     * Get payers that require attending physician supervision
     */
    static async getPayersRequiringAttending(): Promise<Payer[]> {
        try {
            const { data, error } = await supabase
                .from('payers')
                .select('*')
                .eq('requires_attending', true)

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching payers requiring attending:', error)
            return []
        }
    }
}
// src/lib/services/PayerService.ts
import { supabase as supabaseClient } from '@/lib/supabase'
import { Payer } from '@/types/database'
import {
  enrichPayerWithStatus as enrichPayerStatus,
  type PayerAcceptanceStatus,
  type PayerWithStatus
} from './payerStatus'

export class PayerService {
  private supabase = supabaseClient

  /**
   * Search payers with fuzzy matching - shows ALL payers for transparency
   * Users can see what's coming soon or not accepted yet
   */
  async searchPayers(query: string): Promise<PayerWithStatus[]> {
    if (!query || query.length < 2) {
      return []
    }

    try {
      const { data: payers, error } = await this.supabase
        .from('payers')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name')

      if (error) {
        console.error('Error searching payers:', error)
        return []
      }

      if (!payers) {
        return []
      }

      const enrichedPayers = payers.map(payer => this.enrichPayerWithStatus(payer))
      
      // Sort by acceptance priority: active first, then future, then not-accepted
      return enrichedPayers.sort((a, b) => {
        const priorityOrder = { active: 1, future: 2, 'not-accepted': 3 }
        const aPriority = priorityOrder[a.acceptanceStatus]
        const bPriority = priorityOrder[b.acceptanceStatus]
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        // Within same status, sort alphabetically
        return (a.name || '').localeCompare(b.name || '')
      })
    } catch (error) {
      console.error('PayerService.searchPayers error:', error)
      return []
    }
  }

  /**
   * Get only currently accepted payers for quick booking
   */
  async getAcceptedPayers(): Promise<PayerWithStatus[]> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const { data: payers, error } = await this.supabase
        .from('payers')
        .select('*')
        .eq('status_code', 'Approved')
        .not('effective_date', 'is', null)
        .lte('effective_date', today)
        .order('name')

      if (error) {
        console.error('Error getting accepted payers:', error)
        return []
      }

      if (!payers) {
        return []
      }

      const enrichedPayers = payers.map(payer => this.enrichPayerWithStatus(payer))
      
      // Sort by acceptance priority: active first, then future, then not-accepted
      return enrichedPayers.sort((a, b) => {
        const priorityOrder = { active: 1, future: 2, 'not-accepted': 3 }
        const aPriority = priorityOrder[a.acceptanceStatus]
        const bPriority = priorityOrder[b.acceptanceStatus]
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        // Within same status, sort alphabetically
        return (a.name || '').localeCompare(b.name || '')
      })
    } catch (error) {
      console.error('PayerService.getAcceptedPayers error:', error)
      return []
    }
  }

  /**
   * Get payer by ID with status enrichment
   */
  async getPayerById(id: string): Promise<PayerWithStatus | null> {
    try {
      const { data: payer, error } = await this.supabase
        .from('payers')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !payer) {
        console.error('Error getting payer by ID:', error)
        return null
      }

      return this.enrichPayerWithStatus(payer)
    } catch (error) {
      console.error('PayerService.getPayerById error:', error)
      return null
    }
  }

  /**
   * CORE BUSINESS LOGIC: Determine acceptance status based on Moonlit's rules
   */
  private enrichPayerWithStatus(payer: Payer): PayerWithStatus {
    return enrichPayerStatus(payer)
  }

  /**
   * Check if payer requires supervised care (attending physician)
   */
  requiresAttendingProvider(payer: Payer): boolean {
    return payer.requires_attending || false
  }

  /**
   * Check if payer requires individual provider contracts
   */
  requiresIndividualContract(payer: Payer): boolean {
    return payer.requires_individual_contract || false
  }

  /**
   * Get user-friendly payer type description
   */
  getPayerTypeDescription(payer: Payer): string {
    switch (payer.payer_type) {
      case 'Medicaid':
        return 'Medicaid'
      case 'Private':
        return 'Private Insurance'
      default:
        return payer.payer_type || 'Insurance'
    }
  }

  /**
   * Check if a payer is currently accepting new patients
   */
  isCurrentlyAccepting(payer: Payer): boolean {
    const today = new Date()
    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
    
    return (
      payer.status_code === 'Approved' &&
      effectiveDate !== null &&
      effectiveDate <= today
    )
  }
}

// Export singleton instance
export const payerService = new PayerService()

// src/lib/services/PayerService.ts
import { supabase as supabaseClient } from '@/lib/supabase'
import { Payer } from '@/types/database'

export type PayerAcceptanceStatus = 'active' | 'future' | 'not-accepted'

export interface PayerWithStatus extends Payer {
  acceptanceStatus: PayerAcceptanceStatus
  statusMessage: string
}

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
        .eq('credentialing_status', 'Approved')
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
    const today = new Date()
    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null
    const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null

    let acceptanceStatus: PayerAcceptanceStatus
    let statusMessage: string

    // MOONLIT BUSINESS LOGIC
    if (
      payer.credentialing_status === 'Approved' &&
      effectiveDate && 
      effectiveDate <= today
    ) {
      // ✅ Currently accepting - we're credentialed and effective
      acceptanceStatus = 'active'
      statusMessage = "We're in network with your payer."
      
      // Add supervision info if needed
      if (payer.requires_attending) {
        statusMessage += " All appointments will be supervised by our attending physician."
      }
    } else if (
      payer.credentialing_status === 'Approved' &&
      effectiveDate && 
      effectiveDate > today
    ) {
      // 🕐 Future acceptance - approved but not effective yet
      acceptanceStatus = 'future'
      statusMessage = `We'll be in network starting ${effectiveDate.toLocaleDateString()}.`
    } else if (
      projectedDate && 
      projectedDate > today &&
      ['Waiting on them', 'In progress'].includes(payer.credentialing_status || '')
    ) {
      // 🔜 Projected future acceptance
      acceptanceStatus = 'future'
      statusMessage = `We're working to accept this insurance by ${projectedDate.toLocaleDateString()}.`
    } else if (
      ['Waiting on them', 'In progress'].includes(payer.credentialing_status || '')
    ) {
      // 🔄 In progress but no timeline
      acceptanceStatus = 'future'
      statusMessage = "We're working to get in network with this payer. Join our waitlist!"
    } else {
      // ❌ Not accepted - blocked, denied, not started, etc.
      acceptanceStatus = 'not-accepted'
      
      switch (payer.credentialing_status) {
        case 'X Denied or perm. blocked':
          statusMessage = "This payer doesn't accept new providers currently, but you can join our waitlist."
          break
        case 'Blocked':
          statusMessage = "We're temporarily unable to accept this insurance. Join our waitlist for updates."
          break
        case 'On pause':
          statusMessage = "We've paused credentialing with this payer. Join our waitlist for updates."
          break
        case 'Not started':
          statusMessage = "We haven't started credentialing with this payer yet. Join our waitlist!"
          break
        default:
          statusMessage = "We don't currently accept this insurance, but you can join our waitlist."
      }
    }

    return {
      ...payer,
      acceptanceStatus,
      statusMessage
    }
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
      payer.credentialing_status === 'Approved' &&
      effectiveDate !== null &&
      effectiveDate <= today
    )
  }
}

// Export singleton instance
export const payerService = new PayerService()
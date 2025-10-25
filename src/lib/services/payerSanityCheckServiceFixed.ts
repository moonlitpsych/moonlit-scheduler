import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export interface ValidationResult {
  level: 'error' | 'warning' | 'info'
  category: string
  message: string
  details?: any
}

export interface SanityCheckResults {
  validations: ValidationResult[]
  bookableProviders: any[]
  supervisorIssues: any[]
  residentIssues: any[]
  blockedProviders: any[]
  pendingEffectiveDates: any[]
  hasErrors: boolean
  hasWarnings: boolean
}

/**
 * Comprehensive sanity check service for payer contract management
 * Fixed version using direct Supabase queries instead of RPC
 */
export class PayerSanityCheckService {
  /**
   * Run all sanity checks for a payer and return comprehensive results
   */
  async runAllChecks(
    payerId: string,
    effectiveDate?: string
  ): Promise<SanityCheckResults> {
    const validations: ValidationResult[] = []
    const checkDate = effectiveDate || new Date().toISOString().split('T')[0]

    console.log('🔍 Running comprehensive sanity checks for payer:', payerId, 'as of date:', checkDate)

    // 1. Check who's actually bookable today
    const bookableProviders = await this.checkBookableProviders(payerId, checkDate)

    if (bookableProviders.length === 0) {
      validations.push({
        level: 'warning',
        category: 'Bookability',
        message: 'No providers are currently bookable for this payer',
        details: { count: 0 }
      })
    } else {
      validations.push({
        level: 'info',
        category: 'Bookability',
        message: `${bookableProviders.length} provider(s) are bookable for this payer`,
        details: { count: bookableProviders.length, providers: bookableProviders }
      })
    }

    // 2. Check supervisors without contracts
    const supervisorIssues = await this.checkSupervisorsWithoutContracts(payerId, checkDate)

    if (supervisorIssues.length > 0) {
      validations.push({
        level: 'error',
        category: 'Supervision',
        message: `${supervisorIssues.length} supervisor(s) lack in-network contracts but have supervision relationships`,
        details: supervisorIssues
      })
    }

    // 3. Check residents missing supervision
    const residentIssues = await this.checkResidentsMissingSupervision(payerId, checkDate)

    if (residentIssues.length > 0) {
      validations.push({
        level: 'warning',
        category: 'Supervision',
        message: `${residentIssues.length} active resident(s) are missing supervision relationships`,
        details: residentIssues
      })
    }

    // 4. Check providers blocked by flags
    const blockedProviders = await this.checkProvidersBlockedByFlags(payerId, checkDate)

    if (blockedProviders.length > 0) {
      validations.push({
        level: 'info',
        category: 'Provider Flags',
        message: `${blockedProviders.length} provider(s) have contracts but are blocked by their flags`,
        details: blockedProviders
      })
    }

    // 5. Check contracts not yet effective
    const pendingEffectiveDates = await this.checkPendingEffectiveDates(payerId, checkDate)

    if (pendingEffectiveDates.length > 0) {
      validations.push({
        level: 'info',
        category: 'Effective Dates',
        message: `${pendingEffectiveDates.length} contract(s) are not yet effective`,
        details: pendingEffectiveDates
      })
    }

    // Check payer configuration
    const payerConfig = await this.checkPayerConfiguration(payerId)
    if (payerConfig) {
      validations.push(...payerConfig)
    }

    return {
      validations,
      bookableProviders,
      supervisorIssues,
      residentIssues,
      blockedProviders,
      pendingEffectiveDates,
      hasErrors: validations.some(v => v.level === 'error'),
      hasWarnings: validations.some(v => v.level === 'warning')
    }
  }

  /**
   * Check who's actually bookable for a payer on a given date
   * Using direct Supabase queries
   */
  async checkBookableProviders(payerId: string, checkDate: string): Promise<any[]> {
    try {
      // First get payer settings
      const { data: payer, error: payerError } = await supabase
        .from('payers')
        .select('requires_attending, allows_supervised')
        .eq('id', payerId)
        .single()

      if (payerError || !payer) {
        console.error('❌ Error fetching payer:', payerError)
        return []
      }

      // Get providers with direct contracts
      const { data: directContracts, error: contractError } = await supabase
        .from('provider_payer_networks')
        .select(`
          provider_id,
          effective_date,
          expiration_date,
          bookable_from_date,
          providers!inner(
            id,
            first_name,
            last_name,
            role,
            is_active,
            is_bookable,
            accepts_new_patients
          )
        `)
        .eq('payer_id', payerId)
        .eq('status', 'in_network')

      if (contractError) {
        console.error('❌ Error fetching contracts:', contractError)
        return []
      }

      const bookableProviders: any[] = []

      // Filter for currently effective contracts
      const effectiveContracts = (directContracts || []).filter(contract => {
        const effectiveDate = contract.effective_date
        const expirationDate = contract.expiration_date
        const bookableFromDate = contract.bookable_from_date

        // Check if contract is effective on the check date
        const isEffective = (!effectiveDate || effectiveDate <= checkDate) &&
                          (!expirationDate || expirationDate >= checkDate) &&
                          (!bookableFromDate || bookableFromDate <= checkDate)

        // Check if provider meets bookability requirements
        const provider = contract.providers
        const isProviderBookable = provider.is_active &&
                                  provider.is_bookable &&
                                  provider.accepts_new_patients

        if (isEffective && isProviderBookable) {
          // Check if this is an attending (can book directly) or needs supervision
          if (!payer.requires_attending ||
              ['Attending', 'Physician', 'Medical Director'].includes(provider.role)) {
            bookableProviders.push({
              provider_id: provider.id,
              first_name: provider.first_name,
              last_name: provider.last_name,
              role: provider.role,
              path: 'direct_ppn',
              supervising_attendings: []
            })
            return true
          }
        }
        return false
      })

      // If payer allows supervised care, check for supervised providers
      if (payer.allows_supervised && payer.requires_attending) {
        const { data: supervisionRelationships, error: supervisionError } = await supabase
          .from('supervision_relationships')
          .select(`
            supervisor_provider_id,
            supervisee_provider_id,
            providers!supervision_relationships_supervisee_provider_id_fkey(
              id,
              first_name,
              last_name,
              role,
              is_active,
              is_bookable,
              accepts_new_patients
            )
          `)
          .eq('payer_id', payerId)
          .eq('is_active', true)

        if (!supervisionError && supervisionRelationships) {
          // Get attending IDs who have contracts
          const attendingIds = effectiveContracts
            .filter(c => ['Attending', 'Physician', 'Medical Director'].includes(c.providers.role))
            .map(c => c.provider_id)

          // Add supervised providers
          for (const rel of supervisionRelationships) {
            if (attendingIds.includes(rel.supervisor_provider_id)) {
              const provider = rel.providers
              if (provider && provider.is_active && provider.is_bookable && provider.accepts_new_patients) {
                bookableProviders.push({
                  provider_id: provider.id,
                  first_name: provider.first_name,
                  last_name: provider.last_name,
                  role: provider.role,
                  path: 'supervised_via_attending',
                  supervising_attendings: [rel.supervisor_provider_id]
                })
              }
            }
          }
        }
      }

      return bookableProviders

    } catch (error) {
      console.error('❌ Error in checkBookableProviders:', error)
      return []
    }
  }

  /**
   * Check for supervisors who lack an effective, in-network contract
   */
  async checkSupervisorsWithoutContracts(payerId: string, checkDate: string): Promise<any[]> {
    try {
      // Get all supervision relationships for this payer
      const { data: supervisionRels, error: supervisionError } = await supabase
        .from('supervision_relationships')
        .select('*')
        .eq('payer_id', payerId)
        .eq('is_active', true)

      if (supervisionError || !supervisionRels) {
        console.error('❌ Error fetching supervision relationships:', supervisionError)
        return []
      }

      // Get unique supervisor IDs (handle both column naming conventions)
      const supervisorIds = [...new Set(supervisionRels.map(r =>
        r.supervisor_provider_id || r.attending_provider_id
      ))]

      // Check which supervisors have effective contracts
      const { data: contracts, error: contractError } = await supabase
        .from('provider_payer_networks')
        .select('provider_id, effective_date, expiration_date, bookable_from_date')
        .eq('payer_id', payerId)
        .eq('status', 'in_network')
        .in('provider_id', supervisorIds)

      if (contractError) {
        console.error('❌ Error fetching supervisor contracts:', contractError)
        return []
      }

      // Find supervisors without effective contracts
      const supervisorsWithoutContracts: any[] = []

      for (const supervisorId of supervisorIds) {
        const contract = contracts?.find(c => c.provider_id === supervisorId)

        if (!contract ||
            (contract.effective_date && contract.effective_date > checkDate) ||
            (contract.expiration_date && contract.expiration_date < checkDate) ||
            (contract.bookable_from_date && contract.bookable_from_date > checkDate)) {

          const supervisor = supervisionRels.find(r =>
            (r.supervisor_provider_id || r.attending_provider_id) === supervisorId
          )
          if (supervisor) {
            // Get provider name separately since we don't have the join
            const { data: provider } = await supabase
              .from('providers')
              .select('first_name, last_name')
              .eq('id', supervisorId)
              .single()

            supervisorsWithoutContracts.push({
              provider_id: supervisorId,
              supervisor_name: provider ? `${provider.first_name} ${provider.last_name}` : 'Unknown'
            })
          }
        }
      }

      return supervisorsWithoutContracts

    } catch (error) {
      console.error('❌ Error in checkSupervisorsWithoutContracts:', error)
      return []
    }
  }

  /**
   * Check for residents missing an active supervision link for this payer
   */
  async checkResidentsMissingSupervision(payerId: string, checkDate: string): Promise<any[]> {
    try {
      // Get all active residents
      const { data: residents, error: residentError } = await supabase
        .from('providers')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .eq('is_bookable', true)
        .eq('accepts_new_patients', true)
        .in('role', ['Resident', 'Fellow', 'Intern', 'Nurse Practitioner', 'Physician Assistant'])

      if (residentError || !residents) {
        console.error('❌ Error fetching residents:', residentError)
        return []
      }

      // Get supervision relationships for this payer
      const { data: supervisionRels, error: supervisionError } = await supabase
        .from('supervision_relationships')
        .select('supervisee_provider_id')
        .eq('payer_id', payerId)
        .eq('is_active', true)

      if (supervisionError) {
        console.error('❌ Error fetching supervision relationships:', supervisionError)
        return []
      }

      const supervisedResidentIds = new Set((supervisionRels || []).map(r => r.supervisee_provider_id))

      // Find residents without supervision
      const unsupervisedResidents = residents.filter(r => !supervisedResidentIds.has(r.id))

      return unsupervisedResidents.map(r => ({
        provider_id: r.id,
        resident_name: `${r.first_name} ${r.last_name}`
      }))

    } catch (error) {
      console.error('❌ Error in checkResidentsMissingSupervision:', error)
      return []
    }
  }

  /**
   * Check providers blocked by base flags (active/networked but not bookable)
   */
  async checkProvidersBlockedByFlags(payerId: string, checkDate: string): Promise<any[]> {
    try {
      // Get all providers with contracts
      const { data: contracts, error: contractError } = await supabase
        .from('provider_payer_networks')
        .select(`
          provider_id,
          effective_date,
          expiration_date,
          bookable_from_date,
          providers!inner(
            id,
            first_name,
            last_name,
            is_active,
            is_bookable,
            accepts_new_patients
          )
        `)
        .eq('payer_id', payerId)
        .eq('status', 'in_network')

      if (contractError || !contracts) {
        console.error('❌ Error fetching contracts:', contractError)
        return []
      }

      const blockedProviders: any[] = []

      for (const contract of contracts) {
        // Check if contract is effective
        const isEffective = (!contract.effective_date || contract.effective_date <= checkDate) &&
                          (!contract.expiration_date || contract.expiration_date >= checkDate) &&
                          (!contract.bookable_from_date || contract.bookable_from_date <= checkDate)

        if (isEffective) {
          const provider = contract.providers
          const isBlocked = !provider.is_active || !provider.is_bookable || !provider.accepts_new_patients

          if (isBlocked) {
            blockedProviders.push({
              provider_id: provider.id,
              provider_name: `${provider.first_name} ${provider.last_name}`,
              is_active: provider.is_active,
              is_bookable: provider.is_bookable,
              accepts_new_patients: provider.accepts_new_patients,
              blocking_reason: !provider.is_active ? 'Provider is inactive' :
                             !provider.is_bookable ? 'Provider is not bookable' :
                             'Provider not accepting new patients'
            })
          }
        }
      }

      return blockedProviders

    } catch (error) {
      console.error('❌ Error in checkProvidersBlockedByFlags:', error)
      return []
    }
  }

  /**
   * Check for provider_payer_network rows not yet effective
   */
  async checkPendingEffectiveDates(payerId: string, checkDate: string): Promise<any[]> {
    try {
      const { data: contracts, error } = await supabase
        .from('provider_payer_networks')
        .select(`
          provider_id,
          effective_date,
          expiration_date,
          bookable_from_date,
          providers!inner(
            first_name,
            last_name
          )
        `)
        .eq('payer_id', payerId)
        .eq('status', 'in_network')

      if (error || !contracts) {
        console.error('❌ Error fetching contracts:', error)
        return []
      }

      const pendingContracts: any[] = []

      for (const contract of contracts) {
        let status = 'ok'

        if (contract.bookable_from_date && contract.bookable_from_date > checkDate) {
          status = 'blocked_by_bookable_from_date'
        } else if (contract.effective_date && contract.effective_date > checkDate) {
          status = 'future_effective_date'
        }

        if (status !== 'ok') {
          pendingContracts.push({
            provider_id: contract.provider_id,
            provider_name: `${contract.providers.first_name} ${contract.providers.last_name}`,
            effective_date: contract.effective_date,
            expiration_date: contract.expiration_date,
            bookable_from_date: contract.bookable_from_date,
            ppn_status: status
          })
        }
      }

      return pendingContracts

    } catch (error) {
      console.error('❌ Error in checkPendingEffectiveDates:', error)
      return []
    }
  }

  /**
   * Check payer configuration for potential issues
   */
  async checkPayerConfiguration(payerId: string): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = []

    const { data: payer, error } = await supabase
      .from('payers')
      .select('*')
      .eq('id', payerId)
      .single()

    if (error || !payer) {
      validations.push({
        level: 'error',
        category: 'Payer Configuration',
        message: 'Unable to fetch payer configuration'
      })
      return validations
    }

    // Check for logical inconsistencies
    if (payer.requires_attending && !payer.allows_supervised) {
      validations.push({
        level: 'warning',
        category: 'Payer Configuration',
        message: 'Payer requires attending but does not allow supervised care - this may prevent resident bookings'
      })
    }

    if (!payer.effective_date) {
      validations.push({
        level: 'warning',
        category: 'Payer Configuration',
        message: 'Payer has no effective date set'
      })
    }

    if (payer.status_code !== 'approved') {
      validations.push({
        level: 'info',
        category: 'Payer Configuration',
        message: `Payer status is "${payer.status_code || 'not set'}" - providers may not be bookable until approved`
      })
    }

    return validations
  }

  /**
   * Generate a summary report of all checks
   */
  generateSummaryReport(results: SanityCheckResults): string {
    const lines: string[] = []

    lines.push('=== Payer Contract Sanity Check Report ===')
    lines.push('')

    if (results.hasErrors) {
      lines.push('❌ ERRORS FOUND - Please review before proceeding')
    } else if (results.hasWarnings) {
      lines.push('⚠️  WARNINGS FOUND - Review recommended')
    } else {
      lines.push('✅ ALL CHECKS PASSED')
    }

    lines.push('')
    lines.push('Summary:')
    lines.push(`- Bookable Providers: ${results.bookableProviders.length}`)
    lines.push(`- Supervisor Issues: ${results.supervisorIssues.length}`)
    lines.push(`- Resident Issues: ${results.residentIssues.length}`)
    lines.push(`- Blocked Providers: ${results.blockedProviders.length}`)
    lines.push(`- Pending Contracts: ${results.pendingEffectiveDates.length}`)

    lines.push('')
    lines.push('Detailed Findings:')

    for (const validation of results.validations) {
      const icon = validation.level === 'error' ? '❌' :
                   validation.level === 'warning' ? '⚠️' : 'ℹ️'
      lines.push(`${icon} [${validation.category}] ${validation.message}`)
    }

    return lines.join('\n')
  }
}

// Export singleton instance
export const payerSanityCheck = new PayerSanityCheckService()
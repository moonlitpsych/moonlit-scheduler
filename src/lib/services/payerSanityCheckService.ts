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
 * Implements all validation checks from the manual SQL process
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
   * Implements the comprehensive bookability query
   */
  async checkBookableProviders(payerId: string, checkDate: string): Promise<any[]> {
    const query = `
      WITH payer AS (
        SELECT id AS payer_id, requires_attending, allows_supervised
        FROM public.payers
        WHERE id = $1
      ),
      ppn_ok AS (
        SELECT n.provider_id, n.payer_id, n.status,
               (
                 (n.effective IS NOT NULL AND $2::date <@ n.effective)
                 OR (n.effective IS NULL
                     AND n.effective_date IS NOT NULL
                     AND n.effective_date <= $2::date
                     AND (n.expiration_date IS NULL OR n.expiration_date >= $2::date))
               )
               AND (n.bookable_from_date IS NULL OR n.bookable_from_date <= $2::date) AS is_effective_now
        FROM public.provider_payer_networks n
        JOIN payer py ON py.payer_id = n.payer_id
        WHERE n.status = 'in_network'
      ),
      supervision AS (
        SELECT sr.supervisor_provider_id, sr.supervisee_provider_id
        FROM public.supervision_relationships sr
        JOIN payer py ON py.payer_id = sr.payer_id
        WHERE sr.is_active = TRUE
          AND sr.start_date <= $2::date
          AND (sr.end_date IS NULL OR sr.end_date >= $2::date)
      ),
      prov_base AS (
        SELECT p.id AS provider_id, p.first_name, p.last_name, p.role,
               p.is_active, p.is_bookable, p.accepts_new_patients
        FROM public.providers p
        WHERE p.is_active = TRUE AND p.is_bookable = TRUE AND p.accepts_new_patients = TRUE
      ),
      direct_candidates AS (
        SELECT b.*, 'direct_ppn'::text AS path, ARRAY[]::text[] AS supervising_attendings
        FROM prov_base b
        JOIN ppn_ok n ON n.provider_id = b.provider_id AND n.is_effective_now = TRUE
        JOIN payer py ON TRUE
        LEFT JOIN (SELECT DISTINCT supervisor_provider_id FROM supervision) sup
          ON sup.supervisor_provider_id = b.provider_id
        WHERE (py.requires_attending = FALSE) OR (sup.supervisor_provider_id IS NOT NULL)
      ),
      supervised_candidates AS (
        SELECT
          b.*, 'supervised_via_attending'::text AS path,
          ARRAY_AGG(DISTINCT sp.first_name || ' ' || sp.last_name) AS supervising_attendings
        FROM prov_base b
        JOIN payer py ON TRUE
        JOIN supervision s ON s.supervisee_provider_id = b.provider_id
        JOIN ppn_ok n_att ON n_att.provider_id = s.supervisor_provider_id AND n_att.is_effective_now = TRUE
        JOIN public.providers sp ON sp.id = s.supervisor_provider_id
        WHERE py.requires_attending = TRUE AND py.allows_supervised = TRUE
        GROUP BY b.provider_id, b.first_name, b.last_name, b.role, b.is_active, b.is_bookable, b.accepts_new_patients
      )
      SELECT * FROM (
        SELECT * FROM direct_candidates
        UNION
        SELECT * FROM supervised_candidates
      ) q
      ORDER BY q.last_name, q.first_name
    `

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params: [payerId, checkDate]
    }).single()

    if (error) {
      console.error('❌ Error checking bookable providers:', error)
      return []
    }

    return data || []
  }

  /**
   * Check for supervisors who lack an effective, in-network contract
   */
  async checkSupervisorsWithoutContracts(payerId: string, checkDate: string): Promise<any[]> {
    const query = `
      WITH ppn_ok AS (
        SELECT n.provider_id, n.payer_id,
               (
                 (n.effective IS NOT NULL AND $2::date <@ n.effective)
                 OR (n.effective IS NULL
                     AND n.effective_date IS NOT NULL
                     AND n.effective_date <= $2::date
                     AND (n.expiration_date IS NULL OR n.expiration_date >= $2::date))
               )
               AND (n.bookable_from_date IS NULL OR n.bookable_from_date <= $2::date) AS is_effective_now
        FROM public.provider_payer_networks n
        WHERE n.payer_id = $1 AND n.status = 'in_network'
      )
      SELECT DISTINCT
        sp.id AS provider_id,
        sp.first_name || ' ' || sp.last_name AS supervisor_name
      FROM public.supervision_relationships s
      JOIN public.providers sp ON sp.id = s.supervisor_provider_id
      LEFT JOIN ppn_ok n ON n.provider_id = s.supervisor_provider_id
      WHERE s.payer_id = $1
        AND s.is_active = TRUE
        AND s.start_date <= $2::date
        AND (s.end_date IS NULL OR s.end_date >= $2::date)
        AND (n.provider_id IS NULL OR n.is_effective_now = FALSE)
      ORDER BY supervisor_name
    `

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params: [payerId, checkDate]
    }).single()

    if (error) {
      console.error('❌ Error checking supervisors without contracts:', error)
      return []
    }

    return data || []
  }

  /**
   * Check for residents missing an active supervision link for this payer
   */
  async checkResidentsMissingSupervision(payerId: string, checkDate: string): Promise<any[]> {
    const query = `
      SELECT
        r.id AS provider_id,
        r.first_name || ' ' || r.last_name AS resident_name
      FROM public.providers r
      WHERE r.is_active = TRUE
        AND r.is_bookable = TRUE
        AND r.accepts_new_patients = TRUE
        AND r.role IN ('Resident', 'Fellow', 'Intern')
        AND NOT EXISTS (
          SELECT 1
          FROM public.supervision_relationships s
          WHERE s.supervisee_provider_id = r.id
            AND s.payer_id = $1
            AND s.is_active = TRUE
            AND s.start_date <= $2::date
            AND (s.end_date IS NULL OR s.end_date >= $2::date)
        )
      ORDER BY resident_name
    `

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params: [payerId, checkDate]
    }).single()

    if (error) {
      console.error('❌ Error checking residents missing supervision:', error)
      return []
    }

    return data || []
  }

  /**
   * Check providers blocked by base flags (active/networked but not bookable)
   */
  async checkProvidersBlockedByFlags(payerId: string, checkDate: string): Promise<any[]> {
    const query = `
      WITH ppn_ok AS (
        SELECT n.provider_id
        FROM public.provider_payer_networks n
        WHERE n.payer_id = $1
          AND n.status = 'in_network'
          AND (
            (n.effective IS NOT NULL AND $2::date <@ n.effective)
            OR (n.effective IS NULL
                AND n.effective_date IS NOT NULL
                AND n.effective_date <= $2::date
                AND (n.expiration_date IS NULL OR n.expiration_date >= $2::date))
          )
          AND (n.bookable_from_date IS NULL OR n.bookable_from_date <= $2::date)
      )
      SELECT
        p.id AS provider_id,
        p.first_name || ' ' || p.last_name AS provider_name,
        p.is_active,
        p.is_bookable,
        p.accepts_new_patients,
        CASE
          WHEN p.is_active IS NOT TRUE THEN 'Provider is inactive'
          WHEN p.is_bookable IS NOT TRUE THEN 'Provider is not bookable'
          WHEN p.accepts_new_patients IS NOT TRUE THEN 'Provider not accepting new patients'
          ELSE 'Unknown flag issue'
        END AS blocking_reason
      FROM public.providers p
      JOIN ppn_ok n ON n.provider_id = p.id
      WHERE (p.is_active IS NOT TRUE OR p.is_bookable IS NOT TRUE OR p.accepts_new_patients IS NOT TRUE)
      ORDER BY provider_name
    `

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params: [payerId, checkDate]
    }).single()

    if (error) {
      console.error('❌ Error checking providers blocked by flags:', error)
      return []
    }

    return data || []
  }

  /**
   * Check for provider_payer_network rows not yet effective
   */
  async checkPendingEffectiveDates(payerId: string, checkDate: string): Promise<any[]> {
    const query = `
      SELECT
        ppn.provider_id,
        pr.first_name || ' ' || pr.last_name AS provider_name,
        ppn.effective_date,
        ppn.expiration_date,
        ppn.bookable_from_date,
        CASE
          WHEN ppn.bookable_from_date IS NOT NULL AND ppn.bookable_from_date > $2::date THEN 'blocked_by_bookable_from_date'
          WHEN ppn.effective IS NOT NULL AND NOT ($2::date <@ ppn.effective) THEN 'outside_effective_range'
          WHEN ppn.effective IS NULL AND (ppn.effective_date IS NULL OR ppn.effective_date > $2::date) THEN 'future_effective_date'
          ELSE 'ok'
        END AS ppn_status
      FROM public.provider_payer_networks ppn
      JOIN public.providers pr ON pr.id = ppn.provider_id
      WHERE ppn.payer_id = $1
        AND ppn.status = 'in_network'
      ORDER BY provider_name
    `

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params: [payerId, checkDate]
    }).single()

    if (error) {
      console.error('❌ Error checking pending effective dates:', error)
      return []
    }

    // Filter to only return those with issues
    return (data || []).filter((item: any) => item.ppn_status !== 'ok')
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
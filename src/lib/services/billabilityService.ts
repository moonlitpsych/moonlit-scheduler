/**
 * Moonlit Billability Service
 *
 * Validates whether Moonlit can bill a patient's insurance
 * Separate from eligibility checking - eligibility = patient has coverage,
 * billability = Moonlit has a contract to bill that coverage
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Billability validation result
 */
export interface BillabilityResult {
  status: 'ACCEPTED' | 'NOT_CONTRACTED' | 'PLAN_VERIFICATION_NEEDED' | 'ERROR'
  tier: 'PAYER_LEVEL' | 'PLAN_LEVEL' | null
  hasContract: boolean
  contractedPayer: string | null
  contractedPayerId: string | null
  planVerified: boolean
  planName: string | null
  planAccepted: boolean | null
  message: string
  requiresIntakeVerification: boolean
  networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK' | null
}

/**
 * Payer name variations for fuzzy matching
 * Maps common X12 271 payer name variations to canonical names
 */
const PAYER_NAME_MAPPINGS: Record<string, string[]> = {
  // Regence variations
  'regence': [
    'REGENCE',
    'REGENCE BCBS',
    'REGENCE BLUE CROSS',
    'REGENCE BLUE SHIELD',
    'REGENCE BLUE CROSS BLUE SHIELD',
    'REGENCE BLUECROSS BLUESHIELD',
    'REGENCE BC',
    'REGENCE BS'
  ],

  // SelectHealth variations
  'selecthealth': [
    'SELECTHEALTH',
    'SELECT HEALTH',
    'SELECTHEALTH COMMUNITY CARE',
    'SELECT HEALTH COMMUNITY CARE',
    'SELECTHEALTH ADVANTAGE',
    'SELECT HEALTH ADVANTAGE'
  ],

  // Aetna variations
  'aetna': [
    'AETNA',
    'AETNA BETTER HEALTH',
    'AETNA MEDICAID',
    'AETNA LIFE INSURANCE',
    'AETNA CVS HEALTH'
  ],

  // Utah Medicaid
  'utah medicaid': [
    'UTAH MEDICAID',
    'UTAH DEPARTMENT OF HEALTH',
    'UTAH DEPARTMENT OF HEALTH AND HUMAN SERVICES',
    'UDOH',
    'UTMCD',
    'STATE OF UTAH MEDICAID'
  ],

  // Molina
  'molina': [
    'MOLINA',
    'MOLINA HEALTHCARE',
    'MOLINA HEALTHCARE OF UTAH',
    'MOLINA MEDICAID'
  ],

  // Health Choice
  'health choice': [
    'HEALTH CHOICE',
    'HEALTH CHOICE UTAH',
    'HEALTHCHOICE',
    'HEALTHCHOICE UTAH'
  ]
}

/**
 * Normalize payer name for matching
 */
function normalizePayerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
}

/**
 * Fuzzy match payer name from X12 271 to database payers
 */
async function matchPayerName(x12PayerName: string): Promise<{ id: string; name: string } | null> {
  const supabase = getSupabaseClient()
  const normalized = normalizePayerName(x12PayerName)

  console.log(`🔍 Matching payer name: "${x12PayerName}" (normalized: "${normalized}")`)

  // First try: Exact match on normalized name
  const { data: exactMatch } = await supabase
    .from('payers')
    .select('id, name')
    .ilike('name', x12PayerName)
    .limit(1)
    .single()

  if (exactMatch) {
    console.log(`✅ Exact match found: ${exactMatch.name}`)
    return exactMatch
  }

  // Second try: Check against known variations
  for (const [canonical, variations] of Object.entries(PAYER_NAME_MAPPINGS)) {
    if (variations.some(v => normalizePayerName(v) === normalized)) {
      console.log(`✅ Matched via variation mapping: ${canonical}`)

      // Find the canonical payer in database
      const { data: canonicalPayer } = await supabase
        .from('payers')
        .select('id, name')
        .ilike('name', `%${canonical}%`)
        .limit(1)
        .single()

      if (canonicalPayer) {
        return canonicalPayer
      }
    }
  }

  // Third try: Fuzzy match on partial name
  const { data: fuzzyMatches } = await supabase
    .from('payers')
    .select('id, name')
    .ilike('name', `%${normalized.split(' ')[0]}%`)
    .limit(5)

  if (fuzzyMatches && fuzzyMatches.length > 0) {
    console.log(`⚠️  Fuzzy matches found: ${fuzzyMatches.map(p => p.name).join(', ')}`)
    // Return first match but log warning
    console.log(`⚠️  Using first fuzzy match: ${fuzzyMatches[0].name}`)
    return fuzzyMatches[0]
  }

  console.log(`❌ No payer match found for: ${x12PayerName}`)
  return null
}

/**
 * Check if Moonlit has a contract with this payer
 */
async function checkPayerContract(payerId: string): Promise<{
  hasContract: boolean
  providers: string[]
}> {
  const supabase = getSupabaseClient()

  // Query provider_payer_networks for active contracts
  // Note: We check v_bookable_provider_payer for both direct and supervised contracts
  const { data: contracts, error } = await supabase
    .from('v_bookable_provider_payer')
    .select(`
      provider_id,
      payer_id,
      network_status,
      providers (
        id,
        first_name,
        last_name
      )
    `)
    .eq('payer_id', payerId)

  if (error) {
    console.error('Error checking payer contracts:', error)
    return { hasContract: false, providers: [] }
  }

  if (!contracts || contracts.length === 0) {
    return { hasContract: false, providers: [] }
  }

  const providerNames = contracts.map(c =>
    c.providers ? `${c.providers.first_name} ${c.providers.last_name}` : 'Unknown'
  )

  return {
    hasContract: true,
    providers: providerNames
  }
}

/**
 * Main billability validation function
 * @param x12PayerName - Payer name extracted from X12 271 response
 * @param managedCareOrg - MCO name if patient is in managed care
 * @returns Billability validation result
 */
export async function checkMoonlitBillability(
  x12PayerName: string | null,
  managedCareOrg: string | null
): Promise<BillabilityResult> {
  try {
    // Use MCO name if available (more specific than primary payer)
    const payerToCheck = managedCareOrg || x12PayerName

    if (!payerToCheck) {
      return {
        status: 'ERROR',
        tier: null,
        hasContract: false,
        contractedPayer: null,
        contractedPayerId: null,
        planVerified: false,
        planName: null,
        planAccepted: null,
        message: 'No payer information available from eligibility check',
        requiresIntakeVerification: true,
        networkStatus: null
      }
    }

    console.log(`💰 Checking Moonlit billability for: ${payerToCheck}`)

    // Step 1: Match payer name to database
    const matchedPayer = await matchPayerName(payerToCheck)

    if (!matchedPayer) {
      return {
        status: 'NOT_CONTRACTED',
        tier: 'PAYER_LEVEL',
        hasContract: false,
        contractedPayer: null,
        contractedPayerId: null,
        planVerified: false,
        planName: null,
        planAccepted: null,
        message: `Payer "${payerToCheck}" not found in Moonlit's payer database`,
        requiresIntakeVerification: true,
        networkStatus: null
      }
    }

    // Step 2: Check if Moonlit has a contract
    const contractCheck = await checkPayerContract(matchedPayer.id)

    if (!contractCheck.hasContract) {
      return {
        status: 'NOT_CONTRACTED',
        tier: 'PAYER_LEVEL',
        hasContract: false,
        contractedPayer: matchedPayer.name,
        contractedPayerId: matchedPayer.id,
        planVerified: false,
        planName: null,
        planAccepted: null,
        message: `Moonlit does not have a contract with ${matchedPayer.name}`,
        requiresIntakeVerification: false,
        networkStatus: 'OUT_OF_NETWORK'
      }
    }

    // Step 3: Contract exists - plan verification needed
    return {
      status: 'PLAN_VERIFICATION_NEEDED',
      tier: 'PAYER_LEVEL',
      hasContract: true,
      contractedPayer: matchedPayer.name,
      contractedPayerId: matchedPayer.id,
      planVerified: false,
      planName: null,
      planAccepted: null,
      message: `Contract exists with ${matchedPayer.name} - Verify specific plan at intake`,
      requiresIntakeVerification: true,
      networkStatus: 'IN_NETWORK'
    }

  } catch (error) {
    console.error('❌ Billability check failed:', error)
    return {
      status: 'ERROR',
      tier: null,
      hasContract: false,
      contractedPayer: null,
      contractedPayerId: null,
      planVerified: false,
      planName: null,
      planAccepted: null,
      message: `Error checking billability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      requiresIntakeVerification: true,
      networkStatus: null
    }
  }
}

import { AcceptanceStatus } from './database'

/**
 * Individual plan information returned by get_payer_plans_for_ui()
 */
export interface PayerPlanInfo {
  payer_id: string
  payer_name: string
  plan_id: string
  plan_name: string
  plan_type: string | null // HMO, PPO, EPO, POS, HDHP, OTHER
  is_active: boolean
  effective_date: string | null
  expiration_date: string | null
  acceptance_status: AcceptanceStatus // in_network, not_in_network, unknown
  status_source: 'plan_default' | 'provider_override'
  notes: string | null
  provider_has_contract: boolean | null // null if provider_id not provided
}

/**
 * Partitioned plan data for UI display
 * Used to render the three sections: Accepted, Not Accepted, Needs Review
 */
export interface PayerPlanDisplayData {
  payer_id: string
  payer_name: string
  accepted: PayerPlanInfo[] // acceptance_status = 'in_network'
  notAccepted: PayerPlanInfo[] // acceptance_status = 'not_in_network'
  needsReview: PayerPlanInfo[] // acceptance_status = 'unknown'
}

/**
 * Response from the GET /api/payer-plans/[payerId] endpoint
 */
export interface GetPayerPlansResponse {
  success: boolean
  data?: PayerPlanDisplayData
  error?: string
}

/**
 * Parameters for fetching payer plans
 */
export interface GetPayerPlansParams {
  payerId: string
  providerId?: string // Optional: if provided, applies provider-specific overrides
}

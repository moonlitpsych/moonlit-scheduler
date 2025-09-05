// Admin Operations Type Definitions
// Enhanced types for payer rules, supervision mapping, and contract tracking

export interface PayerRule {
  id: string
  payer_id: string
  product_code?: string | null // For product-specific rules
  requires_supervision: boolean
  allowed_supervision_levels: SupervisionLevel[]
  bill_as_type: 'attending' | 'resident' | 'either'
  notes?: string | null
  effective_date: string
  expiration_date?: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export type SupervisionLevel = 'sign_off_only' | 'first_visit_in_person' | 'co_visit_required'

export interface SupervisionRelationship {
  id: string
  resident_provider_id: string
  attending_provider_id: string
  designation: 'primary' | 'secondary'
  effective_date: string
  expiration_date?: string | null
  modality_constraints?: string[] | null // ['telehealth', 'in_person', etc]
  concurrency_cap?: number | null // Max concurrent patients
  status: 'active' | 'inactive' | 'pending'
  notes?: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface ProviderPayerContract {
  id: string
  provider_id: string
  payer_id: string
  contract_type: 'direct' | 'supervised'
  effective_date: string
  termination_date?: string | null
  status: 'pending' | 'active' | 'terminated' | 'suspended'
  notes?: string | null
  requires_roster_rebuild: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  
  // Joined data for display
  provider_name?: string
  payer_name?: string
  supervising_provider_id?: string | null
  supervising_provider_name?: string | null
}

export interface BookableRosterEntry {
  provider_id: string
  payer_id: string
  service_instance_id: string
  is_bookable: boolean
  requires_supervision: boolean
  supervising_provider_id?: string | null
  supervision_level?: SupervisionLevel | null
  bill_as_provider_id: string // Who actually bills
  effective_date: string
  last_rebuild_at: string
  rule_trace: RuleTraceItem[]
}

export interface RuleTraceItem {
  step: string
  rule_type: 'contract' | 'supervision_rule' | 'relationship' | 'capacity' | 'modality'
  result: 'pass' | 'fail' | 'conditional'
  details: string
  data?: Record<string, any>
}

export interface AuditLogEntry {
  id: string
  action: string
  resource_type: 'payer_rule' | 'supervision_relationship' | 'provider_contract'
  resource_id: string
  performed_by: string
  performed_at: string
  changes: {
    before: Record<string, any> | null
    after: Record<string, any> | null
    diff: Array<{
      field: string
      old_value: any
      new_value: any
    }>
  }
  ip_address?: string | null
  user_agent?: string | null
  notes?: string | null
}

export interface RosterRebuildResult {
  success: boolean
  entries_processed: number
  entries_added: number
  entries_removed: number
  errors: Array<{
    provider_id: string
    payer_id: string
    error: string
  }>
  execution_time_ms: number
  triggered_by: 'manual' | 'data_change'
  timestamp: string
}

export interface SimulatorRequest {
  payer_id: string
  service_date: string
  provider_id?: string | null // Optional for "show all eligible providers"
}

export interface SimulatorResult {
  payer_name: string
  service_date: string
  eligible_providers: Array<{
    provider_id: string
    provider_name: string
    is_bookable: boolean
    requires_supervision: boolean
    supervising_provider_id?: string | null
    supervising_provider_name?: string | null
    supervision_level?: SupervisionLevel | null
    bill_as_provider_id: string
    bill_as_provider_name: string
    rule_trace: RuleTraceItem[]
  }>
  total_eligible: number
  query_time_ms: number
}

// UI State Management Types
export interface PayerRuleFormData {
  payer_id: string
  product_code?: string
  requires_supervision: boolean
  allowed_supervision_levels: SupervisionLevel[]
  bill_as_type: 'attending' | 'resident' | 'either'
  notes?: string
  effective_date: string
  expiration_date?: string
}

export interface SupervisionRelationshipFormData {
  resident_provider_id: string
  attending_provider_id: string
  designation: 'primary' | 'secondary'
  effective_date: string
  expiration_date?: string
  modality_constraints?: string[]
  concurrency_cap?: number
  notes?: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: Record<string, any>
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}
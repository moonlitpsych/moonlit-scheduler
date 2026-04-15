export type ProviderTransitionType =
  | 'residency_graduation'
  | 'resident_departure'
  | 'attending_departure'
  | 'attending_termination'
  | 'leave_of_absence'
  | 'return_from_leave'
  | 'supervision_role_change'

export type ProviderTransitionStatus =
  | 'upcoming'
  | 'in_progress'
  | 'bridged'
  | 'completed'
  | 'deferred'
  | 'cancelled'

export interface ProviderTransition {
  id: string
  provider_id: string
  transition_type: ProviderTransitionType
  status: ProviderTransitionStatus
  effective_date: string
  detected_at: string
  detected_by: string
  notes: string | null
  will_continue_at_moonlit: boolean | null
  interested_in_supervising: boolean | null
  bridge_until: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

// Enriched shape returned by the admin list/detail endpoints with
// provider info + downstream-effect summaries baked in.
export interface ProviderTransitionEnriched extends ProviderTransition {
  provider: {
    id: string
    first_name: string | null
    last_name: string | null
    title: string | null
    role: string | null
    residency_org: string | null
    residency_grad_year: number | null
    residency_grad_month: number | null
  }
  active_supervisions: Array<{
    id: string
    supervisor_provider_id: string
    supervisor_name: string
    payer_id: string
    payer_name: string
    end_date: string | null
  }>
  future_appointment_count: number
  days_until_effective: number
}

export const TRANSITION_TYPE_LABELS: Record<ProviderTransitionType, string> = {
  residency_graduation: 'Residency graduation',
  resident_departure: 'Resident departure',
  attending_departure: 'Attending departure',
  attending_termination: 'Attending termination',
  leave_of_absence: 'Leave of absence',
  return_from_leave: 'Return from leave',
  supervision_role_change: 'Supervision role change',
}

export const TRANSITION_STATUS_LABELS: Record<ProviderTransitionStatus, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  bridged: 'Bridged',
  completed: 'Completed',
  deferred: 'Deferred',
  cancelled: 'Cancelled',
}

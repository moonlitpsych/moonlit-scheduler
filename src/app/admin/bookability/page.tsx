import BookabilityOverview from '@/components/bookability/BookabilityOverview'

export interface BookabilityRow {
  provider_id: string
  provider_first_name: string
  provider_last_name: string
  payer_id: string
  payer_name: string
  network_status: 'in_network' | 'supervised'
  billing_provider_id: string | null
  rendering_provider_id: string | null
  state: string | null
  effective_date: string | null
  expiration_date: string | null
  bookable_from_date: string | null
  requires_attending?: boolean
}

export interface FilterState {
  payers: string[]
  providers: string[]
  path: 'all' | 'direct' | 'supervised'
  requiresAttending: 'all' | 'yes' | 'no'
  state: 'all' | 'UT' | 'ID'
  activeToday: boolean
}

export default function AdminBookabilityPage() {
  return <BookabilityOverview isReadOnly={false} />
}
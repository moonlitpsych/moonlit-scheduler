import { redirect } from 'next/navigation'

// This standalone page was a duplicate, orphaned supervision editor (not linked
// from any nav, last functional in Sept 2025, and its supervisor list was always
// empty due to a non-existent role_title column). Supervision is now configured in
// the payer/contract editor, where eligibility is driven by in-network contract
// status — the canonical source of truth (v_bookable_provider_payer). Redirect any
// stale bookmarks there instead of maintaining a second, broken surface.
export default function SupervisionPage() {
  redirect('/admin/contracts')
}

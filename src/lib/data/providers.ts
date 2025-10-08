import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ProviderForCoverage {
  id: string
  label: string
  subtitle: string
}

export async function loadProvidersForCoverageList(): Promise<ProviderForCoverage[]> {
  // For Coverage tool: Show ALL active providers who have contracts,
  // not just those accepting new patients (Travis, Doug, etc. have contracts
  // but may not be accepting new patients)
  const { data, error } = await supabase
    .from('providers')
    .select('id, first_name, last_name, role')
    .eq('is_active', true)
    // Removed: .eq('is_bookable', true) - show all providers with contracts
    // Removed: .eq('accepts_new_patients', true) - show all providers with contracts
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) {
    console.error('❌ Error loading providers for coverage:', error)
    throw error
  }

  // Health check for 0 rows
  if (!error && (data ?? []).length === 0) {
    console.warn('⚠️ providers query returned 0 rows — check env keys/RLS/project target')
  }

  return (data ?? []).map(p => ({
    id: p.id,
    label: `${p.first_name} ${p.last_name}`,
    subtitle: p.role || 'Provider',
  }))
}

export async function loadPayersForCoverageList(): Promise<ProviderForCoverage[]> {
  const { data, error } = await supabase
    .from('payers')
    .select('id, name, payer_type')
    .in('status_code', ['approved', 'active'])
    .order('name', { ascending: true })

  if (error) {
    console.error('❌ Error loading payers for coverage:', error)
    throw error
  }

  // Health check for 0 rows
  if (!error && (data ?? []).length === 0) {
    console.warn('⚠️ payers query returned 0 rows — check env keys/RLS/project target')
  }

  return (data ?? []).map(p => ({
    id: p.id,
    label: p.name,
    subtitle: p.payer_type || 'Payer',
  }))
}
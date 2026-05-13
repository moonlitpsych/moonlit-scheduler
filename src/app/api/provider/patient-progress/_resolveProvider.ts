import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import type { MeasureType } from '@/lib/outcome-measures'

export type ProviderResolution =
  | { ok: true; providerId: string; isAdmin: boolean }
  | { ok: false; status: number; error: string }

/**
 * Resolve which provider's panel a patient-progress request should target.
 * - Authenticated provider → their own providers.id.
 * - Admin caller with `?providerId=…` → honor the override (used by admin impersonation).
 */
export async function resolveProviderForRequest(request: NextRequest): Promise<ProviderResolution> {
  const cookieStore = await cookies()
  // Sync getter intentional: @supabase/auth-helpers-nextjs calls .get() directly on
  // the return value at runtime. The lib's types claim Promise but wrapping in async
  // breaks runtime. Matches the pattern in api/provider-dashboard/patients/search.
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, status: 401, error: 'Authentication required' }

  const isAdmin = await isAdminEmail(session.user.email || '')
  const overrideId = new URL(request.url).searchParams.get('providerId')

  if (isAdmin && overrideId) {
    return { ok: true, providerId: overrideId, isAdmin: true }
  }

  const { data: ownProvider } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!ownProvider?.id) {
    return { ok: false, status: 403, error: 'No provider context found for this account' }
  }
  return { ok: true, providerId: ownProvider.id, isAdmin }
}

/**
 * Parse the `measureType` query param. Accepts a MeasureType or the sentinel
 * 'all' (or missing) → returns null meaning "no filter".
 */
export function parseMeasureTypeParam(request: NextRequest): MeasureType | null {
  const raw = new URL(request.url).searchParams.get('measureType')
  return raw && raw !== 'all' ? (raw as MeasureType) : null
}

/**
 * True iff the patient has at least one appointment with this provider.
 * Authoritative check for "this patient is in this provider's panel."
 */
export async function isPatientInPanel(providerId: string, patientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('appointments')
    .select('id')
    .eq('provider_id', providerId)
    .eq('patient_id', patientId)
    .limit(1)
  return !!data && data.length > 0
}

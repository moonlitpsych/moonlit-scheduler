import { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'

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
  // The auth-helpers lib calls .get() synchronously on the returned value, so this
  // must stay a sync getter even though the lib's types claim it expects a Promise.
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore as never })
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

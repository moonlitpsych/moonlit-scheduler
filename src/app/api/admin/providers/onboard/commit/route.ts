/**
 * Provider Onboarding Wizard — COMMIT step
 *
 * For each selected (and admin-edited) candidate, performs the three onboarding
 * actions the intake form can fully drive:
 *   1. Insert the `providers` row
 *   2. Create + link a Supabase auth account (temp password)
 *   3. Insert `provider_licenses` rows
 *
 * Payer contracts, supervision, availability and IntakeQ settings are NOT
 * handled here — those are separate processes with their own inputs.
 *
 * Each candidate is committed independently and reports per-step status. We do
 * NOT wrap all candidates in a single transaction: a validation failure on one
 * provider should not roll back others. Within a candidate, if the provider row
 * fails we skip auth/licenses; if licenses fail after the row is created we
 * surface it loudly rather than silently deleting an already-created provider.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateProviderData, sanitizeProviderData } from '@/lib/services/providerValidation'
import { Database } from '@/types/database'

type ProviderInsert = Database['public']['Tables']['providers']['Insert']
type LicenseInsert = Database['public']['Tables']['provider_licenses']['Insert']

const TEMP_PASSWORD = 'TempPassword123!'

interface IncomingCandidate {
  provider: Partial<ProviderInsert>
  licenses?: Partial<LicenseInsert>[]
}

interface CandidateResult {
  email: string
  name: string
  success: boolean
  providerId?: string
  authStatus: 'created' | 'already_exists' | 'failed' | 'skipped'
  authUserId?: string
  tempPassword?: string
  licensesCreated: number
  licenseError?: string
  errors?: string[]
}

/** Create or link a Supabase auth user for a provider; returns status. */
async function ensureAuthForProvider(provider: { id: string; email: string; first_name?: string | null; last_name?: string | null }) {
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existing = existingUsers?.users?.find(u => u.email?.toLowerCase() === provider.email.toLowerCase())

  if (existing) {
    await supabaseAdmin.from('providers').update({ auth_user_id: existing.id }).eq('id', provider.id)
    return { authStatus: 'already_exists' as const, authUserId: existing.id }
  }

  const { data: newAuth, error } = await supabaseAdmin.auth.admin.createUser({
    email: provider.email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: provider.first_name,
      last_name: provider.last_name,
      role: 'provider',
      temp_password: true,
      password_set_at: new Date().toISOString(),
    },
  })

  if (error || !newAuth?.user) {
    return { authStatus: 'failed' as const, authError: error?.message || 'Unknown auth error' }
  }

  await supabaseAdmin.from('providers').update({ auth_user_id: newAuth.user.id }).eq('id', provider.id)
  return { authStatus: 'created' as const, authUserId: newAuth.user.id, tempPassword: TEMP_PASSWORD }
}

export async function POST(request: NextRequest) {
  try {
    const { candidates } = await request.json() as { candidates: IncomingCandidate[] }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ success: false, error: 'No candidates provided' }, { status: 400 })
    }

    const results: CandidateResult[] = []

    for (const candidate of candidates) {
      const p = candidate.provider || {}
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || '(unnamed)'
      const email = (p.email || '').toLowerCase()

      // 1. Validate (required fields + email/NPI uniqueness)
      const validation = await validateProviderData(p, false)
      if (!validation.valid) {
        results.push({
          email, name, success: false, authStatus: 'skipped', licensesCreated: 0,
          errors: validation.errors.map(e => `${e.field}: ${e.message}`),
        })
        continue
      }

      // 2. Insert provider row
      const providerData = {
        ...(sanitizeProviderData(p) as ProviderInsert),
        email,
        // sanitizeProviderData doesn't whitelist these — carry them through explicitly.
        residency_grad_year: p.residency_grad_year ?? null,
        residency_grad_month: p.residency_grad_month ?? null,
        is_active: p.is_active ?? true,
        is_bookable: p.is_bookable ?? false,
        list_on_provider_page: p.list_on_provider_page ?? false,
        accepts_new_patients: p.accepts_new_patients ?? true,
        telehealth_enabled: p.telehealth_enabled ?? true,
        profile_completed: false,
        created_date: new Date().toISOString(),
      }

      const { data: provider, error: insertError } = await supabaseAdmin
        .from('providers').insert(providerData).select().single()

      if (insertError || !provider) {
        results.push({
          email, name, success: false, authStatus: 'skipped', licensesCreated: 0,
          errors: [`Provider insert failed: ${insertError?.message || 'unknown error'}`],
        })
        continue
      }

      // 3. Auth account
      let authStatus: CandidateResult['authStatus'] = 'failed'
      let authUserId: string | undefined
      let tempPassword: string | undefined
      const errors: string[] = []
      try {
        const auth = await ensureAuthForProvider({ id: provider.id, email, first_name: provider.first_name, last_name: provider.last_name })
        authStatus = auth.authStatus
        authUserId = auth.authUserId
        tempPassword = (auth as any).tempPassword
        if (auth.authStatus === 'failed') errors.push(`Auth: ${(auth as any).authError}`)
      } catch (e: any) {
        errors.push(`Auth threw: ${e.message}`)
      }

      // 4. Licenses
      let licensesCreated = 0
      let licenseError: string | undefined
      const licenseRows = (candidate.licenses || [])
        .filter(l => l && (l.license_number || l.license_image_url)) // skip empty rows
        .map(l => ({
          provider_id: provider.id,
          license_type: l.license_type ?? null,
          issuing_state: l.issuing_state ?? null,
          license_number: l.license_number ?? null,
          license_image_url: l.license_image_url ?? null,
          expiration_date: l.expiration_date ?? null,
          start_date: l.start_date ?? null,
          created_date: new Date().toISOString(),
        }))

      if (licenseRows.length > 0) {
        const { data: inserted, error: licErr } = await supabaseAdmin
          .from('provider_licenses').insert(licenseRows).select('id')
        if (licErr) licenseError = licErr.message
        else licensesCreated = inserted?.length || 0
      }

      results.push({
        email, name,
        success: true, // provider row created; auth/license issues reported but non-fatal
        providerId: provider.id,
        authStatus, authUserId, tempPassword,
        licensesCreated, licenseError,
        errors: errors.length ? errors : undefined,
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        created: results.filter(r => r.providerId).length,
        failed: results.filter(r => !r.providerId).length,
        authCreated: results.filter(r => r.authStatus === 'created').length,
        licensesCreated: results.reduce((n, r) => n + r.licensesCreated, 0),
      },
      results,
    })
  } catch (error: any) {
    console.error('❌ Onboard commit error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Commit failed' }, { status: 500 })
  }
}

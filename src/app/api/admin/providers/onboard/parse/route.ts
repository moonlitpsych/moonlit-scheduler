/**
 * Provider Onboarding Wizard — PARSE step
 *
 * Accepts the raw "Join Moonlit" intake CSV (as text), maps each row into a
 * provider + licenses payload (see providerOnboardingMapper), and flags rows
 * that already exist in the database (matched by email or NPI) so the admin
 * doesn't double-create. Nothing is written here — this is a dry preview.
 */
import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from '@/lib/supabase'
import { mapFormRows, MappedCandidate } from '@/lib/services/providerOnboardingMapper'

interface ParsedCandidate extends MappedCandidate {
  index: number
  existing: {
    byEmail: boolean
    byNpi: boolean
    providerId?: string
    note?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const { csvText } = await request.json()

    if (!csvText || typeof csvText !== 'string' || csvText.trim() === '') {
      return NextResponse.json({ success: false, error: 'No CSV text provided' }, { status: 400 })
    }

    // Parse WITHOUT object-keying — the form repeats header strings across its
    // three license blocks, so we must keep columns positional.
    let records: string[][]
    try {
      records = parse(csvText, { relax_column_count: true, skip_empty_lines: true, bom: true })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Could not parse CSV: ${e.message}` }, { status: 400 })
    }

    if (!records || records.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV has no data rows' }, { status: 400 })
    }

    const headers = records[0]
    const rows = records.slice(1).filter(r => r.some(cell => (cell || '').trim() !== ''))
    const mapped = mapFormRows(headers, rows)

    // Look up existing providers by email / NPI in one pass each.
    const emails = mapped.map(m => m.provider.email).filter(Boolean) as string[]
    const npis = mapped.map(m => m.provider.npi).filter(Boolean) as string[]

    const existingByEmail = new Map<string, string>()
    const existingByNpi = new Map<string, string>()

    if (emails.length > 0) {
      const { data } = await supabaseAdmin.from('providers').select('id, email').in('email', emails)
      for (const p of data || []) if (p.email) existingByEmail.set(p.email.toLowerCase(), p.id)
    }
    if (npis.length > 0) {
      const { data } = await supabaseAdmin.from('providers').select('id, npi').in('npi', npis)
      for (const p of data || []) if (p.npi) existingByNpi.set(p.npi, p.id)
    }

    const candidates: ParsedCandidate[] = mapped.map((m, i) => {
      const email = m.provider.email?.toLowerCase()
      const npi = m.provider.npi || undefined
      const byEmail = !!(email && existingByEmail.has(email))
      const byNpi = !!(npi && existingByNpi.has(npi))
      const providerId = (email && existingByEmail.get(email)) || (npi && existingByNpi.get(npi)) || undefined

      let note: string | undefined
      if (byEmail && byNpi) note = 'Already in database (email + NPI match) — skip.'
      else if (byEmail) note = 'A provider with this email already exists — skip or verify.'
      else if (byNpi) note = 'A provider with this NPI already exists — skip or verify.'

      return { ...m, index: i, existing: { byEmail, byNpi, providerId, note } }
    })

    return NextResponse.json({
      success: true,
      headerCount: headers.length,
      summary: {
        total: candidates.length,
        new: candidates.filter(c => !c.existing.byEmail && !c.existing.byNpi).length,
        existing: candidates.filter(c => c.existing.byEmail || c.existing.byNpi).length,
      },
      candidates,
    })
  } catch (error: any) {
    console.error('❌ Onboard parse error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Parse failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { Database } from '@/types/database'
import { isAdminEmail } from '@/lib/admin-auth'
import { googleSheetsClient } from '@/lib/integrations/google-sheets/sheets-client'
import { getPractitionerNamesForProvider } from '@/lib/provider-practitioner-names'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// In-memory cache for the sheet read (matches rcm behavior)
let sheetCache: { rows: Record<string, any>[]; timestamp: number } | null = null
const CACHE_TTL_MS = 60_000

function parseDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [m, d, y] = parts
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return dateStr
}

function parseAmount(str: string): number {
  if (!str) return 0
  const cleaned = str.toString().replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const search = searchParams.get('search')?.toLowerCase()
    const requestedProviderId = searchParams.get('providerId')

    // Resolve target provider (admins may impersonate via ?providerId=)
    let provider: { id: string; first_name: string | null; last_name: string | null } | null = null
    if (requestedProviderId && (await isAdminEmail(user.email || ''))) {
      const { data } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .eq('id', requestedProviderId)
        .single()
      provider = data
    } else {
      const { data } = await supabaseAdmin
        .from('providers')
        .select('id, first_name, last_name')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()
      provider = data
    }

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider not found' }, { status: 404 })
    }

    const practitionerNames = getPractitionerNamesForProvider(provider).map(n => n.toLowerCase())

    // Read the Moonlit P&L Appointments sheet (cached 60s)
    let sheetRows: Record<string, any>[]
    if (sheetCache && Date.now() - sheetCache.timestamp < CACHE_TTL_MS) {
      sheetRows = sheetCache.rows
    } else {
      sheetRows = await googleSheetsClient.readSheetAsObjects('Appointments')
      sheetCache = { rows: sheetRows, timestamp: Date.now() }
    }

    let items: any[] = []

    for (const row of sheetRows) {
      const practitioner = (row['Practitioner'] || '').trim()
      if (!practitioner) continue
      if (!practitionerNames.includes(practitioner.toLowerCase())) continue

      const lastName = (row['LastName'] || '').trim()
      const service = (row['Service'] || '').trim()
      if (!lastName && !service) continue

      const apptStatus = (row['ApptStatus'] || '').trim().toLowerCase()
      if (apptStatus === 'test appt') continue
      if (
        apptStatus.includes('missed') ||
        apptStatus.includes('cancel') ||
        apptStatus.includes('no show') ||
        apptStatus.includes('no-show')
      ) {
        continue
      }

      const sheetClaimStatusLower = (row['ClaimStatus'] || '').trim().toLowerCase()
      if (sheetClaimStatusLower.includes('perm') && sheetClaimStatusLower.includes('denied')) continue

      if (lastName.toLowerCase().includes('test')) continue

      const apptDate = parseDate((row['ApptDate'] || row['ApptDatecal'] || '').trim())
      const paidAmount = parseAmount(row['ProviderPaidAmt'])
      const paidDateRaw = (row['ProviderPaidDate'] || '').trim()
      const reimbursement = parseAmount(row['ReimbursementAmount'])
      const claimStatus = (row['ClaimStatus'] || '').trim() || null

      let status: 'paid' | 'unpaid' | 'ready'
      if (paidAmount > 0) status = 'paid'
      else if (reimbursement > 0) status = 'ready'
      else status = 'unpaid'

      items.push({
        appointmentId: `${lastName}|${apptDate}|${service}`,
        date: apptDate,
        patientLastName: lastName,
        service,
        claimStatus,
        earnedCents: Math.round(reimbursement * 100),
        paidCents: Math.round(paidAmount * 100),
        paidDate: paidDateRaw ? parseDate(paidDateRaw) : null,
        reimbursedCents: Math.round(reimbursement * 100),
        status,
      })
    }

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    // Summary computed from the full filtered set (before search/status filtering)
    const totalEarnedCents = items.reduce((s, i) => s + i.earnedCents, 0)
    const totalPaidCents = items.reduce((s, i) => s + i.paidCents, 0)
    const totalOwedCents = totalEarnedCents - totalPaidCents
    const paidCount = items.filter(i => i.status === 'paid').length
    const readyCount = items.filter(i => i.status === 'ready').length
    const totalAppointments = items.length

    if (search) {
      items = items.filter(
        i =>
          i.patientLastName.toLowerCase().includes(search) ||
          i.service.toLowerCase().includes(search)
      )
    }
    if (filter === 'paid') items = items.filter(i => i.status === 'paid')
    else if (filter === 'unpaid') items = items.filter(i => i.status === 'unpaid')
    else if (filter === 'ready') items = items.filter(i => i.status === 'ready')

    return NextResponse.json({
      success: true,
      provider: { id: provider.id, name: `${provider.first_name} ${provider.last_name}` },
      items,
      summary: {
        totalAppointments,
        totalEarnedCents,
        totalPaidCents,
        totalOwedCents,
        paidCount,
        unpaidCount: totalAppointments - paidCount,
        readyCount,
      },
    })
  } catch (error: any) {
    console.error('Provider compensation error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

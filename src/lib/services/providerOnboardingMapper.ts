/**
 * Provider Onboarding Mapper
 *
 * Maps a raw "Join Moonlit" Google-Form CSV row into the shapes our database
 * needs: a `providers` Insert payload plus a set of `provider_licenses` rows.
 *
 * WHY POSITIONAL / RANGE-ANCHORED PARSING:
 * The intake form repeats column headers across its three license blocks
 * (Utah / Idaho / other-state) — e.g. "What is your DEA number?" appears three
 * times and "Please upload a copy of your state license." appears twice. A
 * header-keyed object would silently collapse these collisions. So we operate
 * on the raw header + row arrays (positional), locate each license block by an
 * anchor question, then match fields *within that block's column range* by
 * keyword. This is robust to leading columns being added/removed by the form
 * owner without re-hardcoding indices.
 *
 * Degree mapping accommodates non-MD providers (PhD/PsyD psychologists,
 * CSW/LCSW/MSW social workers), which are now part of the intake stream.
 */

import { Database } from '@/types/database'

type ProviderInsert = Database['public']['Tables']['providers']['Insert']

export interface MappedLicense {
  license_type: string | null
  issuing_state: string | null
  license_number: string | null
  license_image_url: string | null
  expiration_date: string | null
  start_date: string | null
}

export interface MappedCandidate {
  /** Raw degree string from the form, e.g. "MD", "CSW" */
  degreeRaw: string
  /** Provider Insert payload (no id/auth/timestamps — those are set at commit) */
  provider: Partial<ProviderInsert>
  /** Licenses decomposed from the form's three state blocks */
  licenses: MappedLicense[]
  /** Non-fatal issues the admin should review before committing */
  warnings: string[]
}

interface DegreeMapping {
  provider_type: string
  role: string
  title: string
  licenseType: string
}

/**
 * Degree → provider_type / role / title / professional-license type.
 *
 * IMPORTANT value semantics (verified against the live schema 2026-06-19):
 *  - `provider_type` is CHECK-constrained to a fixed set. Physicians use the
 *    TRAINING-LEVEL values 'resident physician' / 'attending physician'.
 *    Non-physician values ('social worker', 'psychologist') were added in
 *    migration 088. MD/DO default to 'resident physician' (this is a residency
 *    intake form) and are editable in the wizard preview if someone is an
 *    attending.
 *  - `role` is the ACCESS role and must be 'provider' for clinical staff
 *    (provider-dashboard access is gated on role === 'provider'). It is NOT the
 *    clinical role — that lives in title/provider_type.
 *  - `title` and the license type are free text and editable in the preview.
 */
export const DEGREE_MAP: Record<string, DegreeMapping> = {
  MD: { provider_type: 'resident physician', role: 'provider', title: 'MD', licenseType: 'Physician & Surgeon' },
  DO: { provider_type: 'resident physician', role: 'provider', title: 'DO', licenseType: 'Physician & Surgeon' },
  PHD: { provider_type: 'psychologist', role: 'provider', title: 'PhD', licenseType: 'Psychologist' },
  PSYD: { provider_type: 'psychologist', role: 'provider', title: 'PsyD', licenseType: 'Psychologist' },
  CSW: { provider_type: 'social worker', role: 'provider', title: 'CSW', licenseType: 'Clinical Social Worker' },
  LCSW: { provider_type: 'social worker', role: 'provider', title: 'LCSW', licenseType: 'Clinical Social Worker' },
  MSW: { provider_type: 'social worker', role: 'provider', title: 'MSW', licenseType: 'Clinical Social Worker' },
}

// ---------------------------------------------------------------------------
// Small parsing helpers
// ---------------------------------------------------------------------------

const norm = (s: string): string => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Treat blank / "N/A" / "none" sentinels as absent. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  const t = value.trim()
  if (t === '') return undefined
  // Collapse to alphanumerics so "N/A.", "No?", "none." all normalize to sentinels.
  const low = t.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (low === 'na' || low === 'none' || low === 'no') return undefined
  return t
}

/** Like clean(), but keeps "no"-style answers (used for gate questions). */
function cleanKeepNo(value: string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  const t = value.trim()
  return t === '' ? undefined : t
}

/** Find the first column whose normalized header contains ALL keywords. */
function findCol(headers: string[], ...keywords: string[]): number {
  const kws = keywords.map(norm)
  return headers.findIndex(h => {
    const nh = norm(h)
    return kws.every(k => nh.includes(k))
  })
}

/** Find a column within [start, end) matching ALL keywords and NONE of `not`. */
function findInRange(
  headers: string[],
  start: number,
  end: number,
  keywords: string[],
  not: string[] = []
): number {
  const kws = keywords.map(norm)
  const nots = not.map(norm)
  for (let i = start; i < end && i < headers.length; i++) {
    const nh = norm(headers[i])
    if (kws.every(k => nh.includes(k)) && nots.every(n => !nh.includes(n))) return i
  }
  return -1
}

const at = (row: string[], idx: number): string | undefined => (idx >= 0 ? row[idx] : undefined)

/** Parse "English, Spanish" → ["English","Spanish"]; keeps DB capitalization. */
function parseLanguages(value: string | undefined): string[] {
  const c = clean(value)
  if (!c) return ['English']
  const parts = c.split(/[,/]+/).map(p => p.trim()).filter(Boolean)
  return parts.length ? parts : ['English']
}

/** Extract a 4-digit year. Returns {year, messy} so caller can warn. */
function parseYear(value: string | undefined): { year?: number; messy: boolean } {
  const c = clean(value)
  if (!c) return { messy: false }
  const m = c.match(/(19|20)\d{2}/)
  if (!m) return { messy: true }
  const year = parseInt(m[0], 10)
  // "messy" if there's meaningful extra content beyond the year (e.g. "2027/28fellowship")
  const messy = c.replace(m[0], '').replace(/[^a-z0-9]/gi, '').length > 0
  return { year, messy }
}

const isDriveLink = (v: string | undefined): boolean => !!v && /drive\.google\.com|docs\.google\.com/i.test(v)

// ---------------------------------------------------------------------------
// License block extraction
// ---------------------------------------------------------------------------

interface BlockResult {
  licenses: MappedLicense[]
  warnings: string[]
}

/**
 * Extract licenses from one state block, given the column range [start, end)
 * for that block. `professionalType` comes from the degree mapping.
 */
function extractBlock(
  headers: string[],
  row: string[],
  start: number,
  end: number,
  issuingState: string,
  professionalType: string,
  opts: { includeCS?: boolean } = {}
): BlockResult {
  const licenses: MappedLicense[] = []
  const warnings: string[] = []

  const blank = (): MappedLicense => ({
    license_type: null,
    issuing_state: issuingState,
    license_number: null,
    license_image_url: null,
    expiration_date: null,
    start_date: null,
  })

  // Professional license number = header in range with "license number" phrase.
  const licNumCol = findInRange(headers, start, end, ['license number'])
  const licNum = clean(at(row, licNumCol))
  const licImgCol = findInRange(headers, start, end, ['upload', 'license'], ['dea'])
  const licImg = clean(at(row, licImgCol))
  if (licNum || licImg) {
    licenses.push({ ...blank(), license_type: professionalType, license_number: licNum ?? null, license_image_url: licImg ?? null })
    if (isDriveLink(licImg)) warnings.push(`${issuingState} ${professionalType} license image is a Google Drive link (not a public URL) — re-upload after creation.`)
  }

  // Utah-only controlled-substance schedule line.
  if (opts.includeCS) {
    const csCol = findInRange(headers, start, end, ['cs schedule'])
    const csNum = clean(at(row, csCol))
    if (csNum) {
      licenses.push({ ...blank(), license_type: 'Controlled Substance (UT)', license_number: csNum })
    }
  }

  // DEA number for this state.
  const deaCol = findInRange(headers, start, end, ['dea number'])
  const deaNum = clean(at(row, deaCol))
  const deaImgCol = findInRange(headers, start, end, ['upload', 'dea'])
  const deaImg = clean(at(row, deaImgCol))
  if (deaNum || deaImg) {
    licenses.push({ ...blank(), license_type: 'DEA', license_number: deaNum ?? null, license_image_url: deaImg ?? null })
    if (isDriveLink(deaImg)) warnings.push(`${issuingState} DEA license image is a Google Drive link (not a public URL) — re-upload after creation.`)
  }

  return { licenses, warnings }
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

/**
 * Map a single form row. `headers` and `row` are positional string arrays
 * (the CSV is parsed WITHOUT object-keying to preserve duplicate headers).
 */
export function mapFormRow(headers: string[], row: string[]): MappedCandidate {
  const warnings: string[] = []

  // --- Degree → type/role/title ---
  const degreeRaw = clean(at(row, findCol(headers, 'what degree do you have'))) || ''
  const degreeKey = degreeRaw.toUpperCase().replace(/[^A-Z]/g, '')
  const degreeMapping = DEGREE_MAP[degreeKey]
  if (!degreeMapping && degreeRaw) {
    warnings.push(`Unrecognized degree "${degreeRaw}" — set provider type, role, title, and license type manually.`)
  }
  const professionalLicenseType = degreeMapping?.licenseType || 'Professional License'

  // --- Core provider fields ---
  const faxPrimary = clean(at(row, findCol(headers, 'fax number')))
  const faxDoximity = clean(at(row, findCol(headers, 'doximity')))

  const medYear = parseYear(at(row, findCol(headers, 'what year did you complete medical school')))
  const resYear = parseYear(at(row, findCol(headers, 'year', 'complete your residency')))
  if (resYear.messy) {
    warnings.push('Residency completion year had extra text (e.g. fellowship note) — verify the parsed year.')
  }

  const headshot = at(row, findCol(headers, 'upload a headshot'))
  if (clean(headshot)) {
    warnings.push('Headshot is a Google Drive link, not a public image — upload the photo manually (in-app upload is currently broken in production).')
  }

  if (degreeMapping && degreeMapping.provider_type !== 'Physician') {
    warnings.push('Non-physician provider: the "medical school" field may actually contain a graduate program — verify education fields.')
  }

  const provider: Partial<ProviderInsert> = {
    first_name: clean(at(row, findCol(headers, 'your first name'))),
    last_name: clean(at(row, findCol(headers, 'your last name'))),
    email: clean(at(row, findCol(headers, 'email address')))?.toLowerCase(),
    npi: clean(at(row, findCol(headers, 'npi'))),
    languages_spoken: parseLanguages(at(row, findCol(headers, 'language'))),
    address: clean(at(row, findCol(headers, 'home address'))),
    phone_number: clean(at(row, findCol(headers, 'phone number'))),
    fax_number: faxPrimary ?? faxDoximity,
    date_of_birth: clean(at(row, findCol(headers, 'date of birth'))),
    location_of_birth: clean(at(row, findCol(headers, 'city and state were you born'))),
    provider_type: degreeMapping?.provider_type,
    role: degreeMapping?.role,
    title: degreeMapping?.title,
    med_school_org: clean(at(row, findCol(headers, 'what medical school'))),
    med_school_grad_year: medYear.year,
    residency_org: clean(at(row, findCol(headers, 'what residency program'))),
    residency_grad_year: resYear.year,
    utah_id: clean(at(row, findCol(headers, 'utahid'))),
    caqh_provider_id: clean(at(row, findCol(headers, 'caqh'))),
    // Status defaults — new providers are NOT bookable/listed until fully set up.
    is_active: true,
    is_bookable: false,
    list_on_provider_page: false,
    accepts_new_patients: true,
    telehealth_enabled: true,
    profile_completed: false,
  }

  if (!provider.npi) warnings.push('No NPI found — confirm before credentialing/booking setup.')

  // --- License blocks (anchored ranges) ---
  const utahAnchor = findCol(headers, 'do you have a utah medical license')
  const idahoAnchor = findCol(headers, 'do you have an idaho medical license')
  const otherAnchor = findCol(headers, 'what other state not yet discussed')
  // The other-state block ends where the post-license questions begin.
  const eduAnchor = findCol(headers, 'what medical school')

  const licenses: MappedLicense[] = []

  if (utahAnchor >= 0) {
    const end = idahoAnchor >= 0 ? idahoAnchor : headers.length
    const utahGate = cleanKeepNo(at(row, utahAnchor)) || ''
    const r = extractBlock(headers, row, utahAnchor + 1, end, 'UT', professionalLicenseType, { includeCS: true })
    if (r.licenses.length === 0 && /^yes/i.test(utahGate)) {
      warnings.push('Form says provider has a Utah license, but no Utah license number was parsed — verify.')
    }
    licenses.push(...r.licenses)
    warnings.push(...r.warnings)
  }

  if (idahoAnchor >= 0) {
    const end = otherAnchor >= 0 ? otherAnchor : (eduAnchor >= 0 ? eduAnchor : headers.length)
    const r = extractBlock(headers, row, idahoAnchor + 1, end, 'ID', professionalLicenseType)
    licenses.push(...r.licenses)
    warnings.push(...r.warnings)
  }

  if (otherAnchor >= 0) {
    const end = eduAnchor >= 0 && eduAnchor > otherAnchor ? eduAnchor : otherAnchor + 6
    const otherState = clean(at(row, otherAnchor))
    if (otherState) {
      const r = extractBlock(headers, row, otherAnchor + 1, end, otherState.toUpperCase().slice(0, 20), professionalLicenseType)
      licenses.push(...r.licenses)
      warnings.push(...r.warnings)
    }
  }

  if (licenses.length === 0) {
    warnings.push('No licenses parsed from any state block — add licenses manually if applicable.')
  } else {
    warnings.push('License expiration dates are not captured by the intake form — fill them in before credentialing.')
  }

  return { degreeRaw, provider, licenses, warnings }
}

/** Map every data row in the form. */
export function mapFormRows(headers: string[], rows: string[][]): MappedCandidate[] {
  return rows.map(r => mapFormRow(headers, r))
}

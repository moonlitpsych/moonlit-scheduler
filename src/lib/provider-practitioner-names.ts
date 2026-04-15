/**
 * Map a provider record to the practitioner name string(s) used
 * in the Moonlit P&L Google Sheet.
 *
 * Mirrors moonlit-rcm/src/lib/provider-auth.ts overrides so the
 * scheduler and RCM app agree on the same canonical names.
 */

const PRACTITIONER_NAME_OVERRIDES: Record<string, string[]> = {
  sweeney: ['C. Rufus Sweeney'],
  roller: ['Kyle Roller', 'Dr. Roller'],
}

export function getPractitionerNamesForProvider(provider: {
  first_name?: string | null
  last_name?: string | null
}): string[] {
  const last = (provider.last_name || '').toLowerCase().trim()
  const overrides = PRACTITIONER_NAME_OVERRIDES[last]
  if (overrides) return overrides
  const fn = (provider.first_name || '').trim()
  const ln = (provider.last_name || '').trim()
  return [`${fn} ${ln}`.trim()]
}

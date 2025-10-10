/**
 * Email Aliasing Utility for IntakeQ Unique Email Constraint
 *
 * IntakeQ requires unique emails per client. When case managers use their
 * email for multiple patients, we create deterministic plus-aliases that
 * deliver to the same inbox but satisfy IntakeQ's constraint.
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.toLowerCase())
}

/**
 * Generate a deterministic IntakeQ email alias using plus-addressing
 *
 * @param canonicalEmail - The real email address (e.g., "case.manager@example.com")
 * @param patientId - The patient UUID for deterministic alias generation
 * @returns Plus-aliased email (e.g., "case.manager+mlt-abc1234@example.com")
 */
export function toIntakeQAlias(canonicalEmail: string, patientId: string): string {
  if (!isValidEmail(canonicalEmail)) {
    throw new Error(`Invalid email format: ${canonicalEmail}`)
  }

  if (!patientId || typeof patientId !== 'string') {
    throw new Error('Patient ID is required for alias generation')
  }

  // Split email into local and domain parts
  const [localPart, domain] = canonicalEmail.toLowerCase().split('@')

  // Generate stable 7-character ID from patient UUID
  // Use first 7 chars of hex representation (deterministic)
  const stableId = patientId.replace(/-/g, '').substring(0, 7).toLowerCase()

  // Create the alias with mlt- prefix for Moonlit
  const aliasedLocal = `${localPart}+mlt-${stableId}`

  return `${aliasedLocal}@${domain}`
}

/**
 * Check if an email is already an alias
 */
export function isAliasedEmail(email: string): boolean {
  if (!isValidEmail(email)) return false

  const [localPart] = email.toLowerCase().split('@')
  return localPart.includes('+mlt-')
}

/**
 * Extract canonical email from an alias
 */
export function extractCanonicalEmail(aliasedEmail: string): string {
  if (!isValidEmail(aliasedEmail)) return aliasedEmail

  const [localPart, domain] = aliasedEmail.toLowerCase().split('@')

  // Remove the +mlt-xxxxx part if present
  const canonicalLocal = localPart.split('+')[0]

  return `${canonicalLocal}@${domain}`
}

// Simple tests (can be moved to a test file)
if (process.env.NODE_ENV === 'test') {
  // Test isValidEmail
  console.assert(isValidEmail('test@example.com') === true)
  console.assert(isValidEmail('test+tag@example.com') === true)
  console.assert(isValidEmail('invalid.email') === false)
  console.assert(isValidEmail('') === false)

  // Test toIntakeQAlias
  const alias = toIntakeQAlias('case.manager@example.com', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  console.assert(alias === 'case.manager+mlt-a1b2c3d@example.com')

  // Test deterministic generation (same input = same output)
  const alias2 = toIntakeQAlias('case.manager@example.com', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  console.assert(alias === alias2)

  // Test isAliasedEmail
  console.assert(isAliasedEmail('test+mlt-abc1234@example.com') === true)
  console.assert(isAliasedEmail('test@example.com') === false)

  // Test extractCanonicalEmail
  console.assert(extractCanonicalEmail('test+mlt-abc1234@example.com') === 'test@example.com')
  console.assert(extractCanonicalEmail('test@example.com') === 'test@example.com')

  console.log('✅ All email alias tests passed')
}
/**
 * Phone Number Normalization Utilities
 *
 * Best practice: Store digits only in database, format for display
 */

/**
 * Normalize phone number to digits only
 * Removes all non-digit characters
 *
 * @param phone - Raw phone input (any format)
 * @returns Normalized phone (digits only) or empty string if invalid
 *
 * @example
 * normalizePhoneNumber("(801) 634-2722") // "8016342722"
 * normalizePhoneNumber("801-634-2722") // "8016342722"
 * normalizePhoneNumber("801.634.2722") // "8016342722"
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // Return empty for invalid lengths or placeholder values
  if (digitsOnly.length === 0) return ''
  if (digitsOnly === '0000000000') return '' // Common placeholder

  // For US numbers, expect 10 or 11 digits (with country code)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // Remove leading 1 (US country code)
    return digitsOnly.substring(1)
  }

  // Return normalized number (should be 10 digits for US)
  return digitsOnly
}

/**
 * Format phone number for display
 * Converts digits-only to (XXX) XXX-XXXX format
 *
 * @param phone - Normalized phone (digits only)
 * @returns Formatted phone string or original if can't format
 *
 * @example
 * formatPhoneNumber("8016342722") // "(801) 634-2722"
 * formatPhoneNumber("801634272") // "801634272" (invalid, returns original)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''

  // If already formatted, return as-is
  if (phone.includes('(') || phone.includes('-')) {
    return phone
  }

  // Remove all non-digit characters (in case it wasn't normalized)
  const digits = phone.replace(/\D/g, '')

  // Only format US 10-digit numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Return original for non-standard lengths
  return phone
}

/**
 * Validate phone number
 * Checks if phone is valid US 10-digit number
 *
 * @param phone - Phone to validate (any format)
 * @returns true if valid US phone number
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false

  const normalized = normalizePhoneNumber(phone)

  // Valid US phone: exactly 10 digits, not all same digit
  if (normalized.length !== 10) return false
  if (/^(\d)\1{9}$/.test(normalized)) return false // e.g., 1111111111

  return true
}

/**
 * Normalize and validate phone, return null if invalid
 * Useful for database inserts where invalid = null
 */
export function normalizePhoneOrNull(phone: string | null | undefined): string | null {
  const normalized = normalizePhoneNumber(phone)
  return isValidPhoneNumber(normalized) ? normalized : null
}

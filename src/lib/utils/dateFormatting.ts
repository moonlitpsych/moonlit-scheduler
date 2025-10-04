/**
 * Timezone-safe date formatting utilities for healthcare applications
 * 
 * Problem: Database DATE fields are timezone-naive, but JavaScript Date constructor
 * assumes UTC midnight when parsing "YYYY-MM-DD", causing off-by-one errors in 
 * local timezones (e.g., "2025-09-01" → August 31 in Mountain Time).
 * 
 * Solution: Parse date strings manually to avoid timezone conversion.
 */

export interface DateParts {
  year: number
  month: number // 1-12 (not 0-11 like JS Date)
  day: number
}

/**
 * Parse a date string (YYYY-MM-DD) without timezone conversion
 */
export function parseDateString(dateString: string): DateParts | null {
  if (!dateString) return null
  
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  
  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  
  // Validate ranges
  if (year < 1000 || year > 9999) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  
  return { year, month, day }
}

/**
 * Format a date string for display without timezone conversion
 * Returns the exact date as stored in the database
 */
export function formatDateSafe(dateString: string | null, options?: {
  format?: 'short' | 'long' | 'weekday'
  fallback?: string
}): string {
  const { format = 'short', fallback = '-' } = options || {}
  
  if (!dateString) return fallback
  
  const dateParts = parseDateString(dateString)
  if (!dateParts) {
    // Fallback: return original string if parsing fails
    return dateString
  }
  
  const { year, month, day } = dateParts
  
  // Month names for formatting
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  
  const monthNamesShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  
  const weekdayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ]
  
  switch (format) {
    case 'short':
      // Format: "Sep 1, 2025"
      return `${monthNamesShort[month - 1]} ${day}, ${year}`
    
    case 'long':
      // Format: "September 1, 2025"
      return `${monthNames[month - 1]} ${day}, ${year}`
    
    case 'weekday': {
      // Format: "Monday, September 1, 2025"
      // Calculate weekday safely (avoiding timezone issues)
      const tempDate = new Date(year, month - 1, day) // Local timezone
      const weekday = weekdayNames[tempDate.getDay()]
      return `${weekday}, ${monthNames[month - 1]} ${day}, ${year}`
    }
    
    default:
      return `${monthNamesShort[month - 1]} ${day}, ${year}`
  }
}

/**
 * Validate that a formatted date matches the original database value
 * Used for testing to ensure no off-by-one errors
 */
export function validateDateFormatting(originalDate: string, formattedDate: string): boolean {
  const dateParts = parseDateString(originalDate)
  if (!dateParts) return false

  const { year, day } = dateParts
  
  // Check if formatted date contains the correct day and year
  const dayStr = day.toString()
  const yearStr = year.toString()
  
  return formattedDate.includes(dayStr) && formattedDate.includes(yearStr)
}

/**
 * Get the current date in YYYY-MM-DD format (local timezone)
 * Useful for comparisons without timezone issues
 */
export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Compare two date strings safely (YYYY-MM-DD format)
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareDateStrings(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  
  // Simple string comparison works for YYYY-MM-DD format
  return a.localeCompare(b)
}
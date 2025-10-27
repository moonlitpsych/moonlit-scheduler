/**
 * CSV Export Utility
 * Converts table data to CSV and triggers download
 */

export function exportToCSV(data: any[], filename: string, columnMapping: Record<string, string>) {
  // Create CSV header
  const headers = Object.values(columnMapping)

  // Create CSV rows
  const rows = data.map(row => {
    return Object.keys(columnMapping).map(key => {
      const value = getNestedValue(row, key)

      // Handle null/undefined
      if (value === null || value === undefined) return ''

      // Handle dates
      if (value instanceof Date) {
        return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }

      // Handle arrays (join with semicolons)
      if (Array.isArray(value)) {
        return value.join('; ')
      }

      // Handle objects (JSON stringify)
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }

      // Escape quotes and wrap in quotes if contains comma or newline
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    })
  })

  // Combine header and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Helper to get nested object values (e.g., "user.name")
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

// Format date for CSV
export function formatDateForCSV(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// Format relative time for CSV
export function formatRelativeTime(dateString: string | null | undefined, isFuture: boolean = false): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = isFuture ? date.getTime() - now.getTime() : now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (isFuture) {
      return `in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    }
  } catch {
    return ''
  }
}

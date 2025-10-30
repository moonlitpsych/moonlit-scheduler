#!/usr/bin/env tsx
/**
 * Enhanced Import for finance data from Moonlit P&L CSV
 * Improved matching algorithm with fuzzy logic and better reporting
 *
 * Usage: npx tsx scripts/import-finance-data-enhanced.ts
 */

import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const CSV_PATH = '/Users/miriam/Downloads/Moonlit P&L - Appointments (5).csv'
const API_BASE = 'http://localhost:3000'

interface CSVRow {
  ApptDate: string
  Service: string
  Practitioner: string
  ProviderPaidAmt: string
  ProviderPaidDate: string
  ClaimStatus: string
  ReimbursementAmount: string
  LastName: string
  Payer: string
  KeyMatch?: string
  ApptStatus?: string
  Price?: string
}

interface MatchResult {
  match: any
  confidence: number
  method: string
}

// Normalize strings for comparison
function normalizeString(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')         // Normalize whitespace
    .trim()
}

// Extract name parts (handles "First Last", "Last, First", and initials)
function extractNameParts(name: string): { first: string, last: string, middle?: string, hasInitial?: boolean } {
  const normalized = name
    .replace(/^(dr|md|do|np)\.?\s+/i, '') // Remove titles
    .replace(/,?\s*(md|do|phd|np|pa-c)\.?$/i, '') // Remove suffixes
    .trim()

  // Check for "Last, First" format
  if (normalized.includes(',')) {
    const [last, first] = normalized.split(',').map(s => s.trim())
    return { first, last }
  }

  // Handle "First Middle Last" or "First Last"
  const parts = normalized.split(/\s+/)

  if (parts.length === 1) {
    return { first: '', last: parts[0] }
  } else if (parts.length === 2) {
    // Could be "First Last" or "Initial Last"
    const hasInitial = parts[0].length <= 2 && parts[0].includes('.')
    return {
      first: parts[0],
      last: parts[1],
      hasInitial
    }
  } else {
    // Could be "Initial First Last" or "First Middle Last"
    const firstPartIsInitial = parts[0].length <= 2 && parts[0].includes('.')

    if (firstPartIsInitial) {
      // Format: "C. Rufus Sweeney" → first="Rufus", last="Sweeney", middle="C."
      return {
        first: parts[1],
        middle: parts[0],
        last: parts.slice(2).join(' ') || parts[1],
        hasInitial: true
      }
    } else {
      // Standard "First Middle Last"
      return {
        first: parts[0],
        middle: parts.slice(1, -1).join(' '),
        last: parts[parts.length - 1]
      }
    }
  }
}

// Calculate name similarity score (0-1)
function calculateNameSimilarity(name1: string, name2: string): number {
  const parts1 = extractNameParts(name1)
  const parts2 = extractNameParts(name2)

  let score = 0
  let factors = 0

  // Compare last names first (most important)
  if (parts1.last && parts2.last) {
    const norm1 = normalizeString(parts1.last)
    const norm2 = normalizeString(parts2.last)
    if (norm1 === norm2) {
      score += 1
      factors++
    } else if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
      score += 0.7
      factors++
    } else {
      // Last name doesn't match - likely different person
      factors++
    }
  }

  // Compare first names
  if (parts1.first && parts2.first) {
    const norm1 = normalizeString(parts1.first)
    const norm2 = normalizeString(parts2.first)

    // Handle initial matching (e.g., "C" matches "Rufus" if rest matches)
    // But "Rufus" matches "Rufus" perfectly
    if (norm1 === norm2) {
      score += 1
      factors++
    } else if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) {
      score += 0.8  // Partial match (e.g., "Chris" vs "Christopher")
      factors++
    } else if (parts1.hasInitial || parts2.hasInitial) {
      // If one name has an initial, be more lenient
      // "C. Rufus Sweeney" should match "Rufus Sweeney" if last name matches
      // Skip penalizing for first name mismatch when middle name is present
      if (parts1.middle || parts2.middle) {
        // Don't penalize, but don't add to score either
        // The middle name/last name combo will determine the match
      } else {
        factors++
      }
    } else {
      factors++
    }
  }

  // Bonus for middle name/initial match
  if (parts1.middle && parts2.middle) {
    const norm1 = normalizeString(parts1.middle)
    const norm2 = normalizeString(parts2.middle)
    if (norm1 === norm2 || norm1[0] === norm2[0]) {
      score += 0.3
      factors += 0.3
    }
  } else if ((parts1.middle || parts2.middle) && (parts1.first || parts2.first)) {
    // Special case: "C. Rufus Sweeney" vs "Rufus Sweeney"
    // If one has middle initial and the other's first name matches the middle position
    const middle = parts1.middle || parts2.middle || ''
    const first1 = normalizeString(parts1.first)
    const first2 = normalizeString(parts2.first)

    if (middle && (first1 === first2 || normalizeString(middle) === first1 || normalizeString(middle) === first2)) {
      // Middle name matches first name of other - this is a match!
      score += 0.9
      factors += 0.3
    }
  }

  return factors > 0 ? score / factors : 0
}

// Find best matching appointment with confidence scoring
function findBestMatch(csvRow: CSVRow, dbAppointments: any[]): MatchResult | null {
  // Parse CSV date to database format
  const dateParts = csvRow.ApptDate.split('/')
  const apptDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`

  const candidates: MatchResult[] = []

  for (const dbAppt of dbAppointments) {
    // Skip if dates don't match
    if (dbAppt.appt_date !== apptDate) continue

    // Calculate patient name similarity
    const patientScore = calculateNameSimilarity(csvRow.LastName || '', dbAppt.last_name || '')

    // Calculate practitioner name similarity
    const practitionerScore = calculateNameSimilarity(csvRow.Practitioner || '', dbAppt.practitioner || '')

    // Calculate service match score
    const serviceScore = normalizeString(csvRow.Service) === normalizeString(dbAppt.service) ? 1 : 0.5

    // Calculate payer match score (if both have payers)
    let payerScore = 0.5 // Default neutral score
    if (csvRow.Payer && dbAppt.payer) {
      payerScore = normalizeString(csvRow.Payer).includes(normalizeString(dbAppt.payer)) ||
                   normalizeString(dbAppt.payer).includes(normalizeString(csvRow.Payer)) ? 1 : 0
    }

    // Calculate overall confidence
    const confidence = (
      patientScore * 35 +        // Patient name is most important
      practitionerScore * 30 +   // Practitioner name is very important
      serviceScore * 20 +         // Service type matters
      payerScore * 15            // Payer is least important
    )

    if (confidence >= 70) {  // 70% confidence threshold
      candidates.push({
        match: dbAppt,
        confidence,
        method: `Date+Names (${Math.round(confidence)}% confidence)`
      })
    }
  }

  // Return best match if found
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.confidence - a.confidence)
    return candidates[0]
  }

  return null
}

async function main() {
  console.log('🔍 Enhanced CSV Import - Reading file...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CSVRow[]

  console.log(`📊 Found ${records.length} appointments in CSV\n`)

  // Fetch all appointments from database
  console.log('🔍 Fetching appointments from database...')
  const response = await fetch(`${API_BASE}/api/finance/appointments?limit=1000`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(`Failed to fetch appointments: ${result.error}`)
  }

  const dbAppointments = result.data || []
  console.log(`📊 Found ${dbAppointments.length} appointments in database\n`)

  // Tracking
  let matched = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  const unmatchedRows: { row: CSVRow, reason: string }[] = []
  const matchedRows: { row: CSVRow, match: any, confidence: number }[] = []

  console.log('🔄 Processing appointments...\n')

  for (const row of records) {
    // Skip test appointments
    if (row.LastName === 'Test' || row.ApptStatus === 'Test appt') {
      skipped++
      continue
    }

    // Find best match
    const matchResult = findBestMatch(row, dbAppointments)

    if (!matchResult) {
      unmatchedRows.push({
        row,
        reason: `No match found for: ${row.ApptDate} ${row.Practitioner} ${row.LastName}`
      })
      continue
    }

    const { match, confidence, method } = matchResult
    matched++
    matchedRows.push({ row, match, confidence })

    // Prepare updates
    const updates = []

    // Column K: ProviderPaidAmt
    if (row.ProviderPaidAmt && row.ProviderPaidAmt !== '0') {
      const amountCents = Math.round(parseFloat(row.ProviderPaidAmt) * 100)
      updates.push({
        column: 'provider_paid_cents',
        value: amountCents,
        label: `Provider Paid: $${row.ProviderPaidAmt}`
      })
    }

    // Column O: ProviderPaidDate
    if (row.ProviderPaidDate && row.ProviderPaidDate.trim() !== '') {
      const dateParts = row.ProviderPaidDate.split('/')
      if (dateParts.length === 3) {
        const paidDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`
        updates.push({
          column: 'provider_paid_date',
          value: paidDate,
          label: `Paid Date: ${row.ProviderPaidDate}`
        })
      }
    }

    // Column T: ClaimStatus
    if (row.ClaimStatus && row.ClaimStatus.toLowerCase() !== 'not needed') {
      updates.push({
        column: 'claim_status',
        value: row.ClaimStatus.toLowerCase(),
        label: `Claim: ${row.ClaimStatus}`
      })
    }

    // Column U: ReimbursementAmount
    if (row.ReimbursementAmount && row.ReimbursementAmount !== '0') {
      const amountCents = Math.round(parseFloat(row.ReimbursementAmount) * 100)
      updates.push({
        column: 'reimbursement_cents',
        value: amountCents,
        label: `Reimbursement: $${row.ReimbursementAmount}`
      })
    }

    if (updates.length === 0) {
      skipped++
      continue
    }

    // Apply updates
    console.log(`✏️  Updating ${row.ApptDate} ${row.Practitioner} ${row.LastName}:`)
    console.log(`   Matched via: ${method}`)

    for (const update of updates) {
      try {
        const updateResponse = await fetch(
          `${API_BASE}/api/finance/appointments/${match.appointment_id}/override`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              column_name: update.column,
              value: update.value,
              reason: `Enhanced CSV import (${Math.round(confidence)}% confidence)`,
              changed_by: null
            })
          }
        )

        const updateResult = await updateResponse.json()

        if (updateResult.success) {
          console.log(`   ✅ ${update.label}`)
          updated++
        } else {
          console.log(`   ❌ Failed: ${update.label} - ${updateResult.error}`)
          errors++
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${update.label} - ${error.message}`)
        errors++
      }
    }

    // Small delay to avoid overwhelming API
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  // Generate detailed report
  console.log('\n' + '='.repeat(80))
  console.log('📊 ENHANCED IMPORT SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total CSV rows:        ${records.length}`)
  console.log(`Matched in DB:         ${matched} (${Math.round(matched / records.length * 100)}%)`)
  console.log(`Fields updated:        ${updated}`)
  console.log(`Skipped (test/empty):  ${skipped}`)
  console.log(`Errors:                ${errors}`)
  console.log('='.repeat(80))

  // Confidence distribution
  if (matchedRows.length > 0) {
    console.log('\n📈 MATCH CONFIDENCE DISTRIBUTION:')
    const confidenceBuckets: Record<string, number> = {
      '95-100%': 0,
      '90-94%': 0,
      '85-89%': 0,
      '80-84%': 0,
      '75-79%': 0,
      '70-74%': 0
    }

    matchedRows.forEach(({ confidence }) => {
      if (confidence >= 95) confidenceBuckets['95-100%']++
      else if (confidence >= 90) confidenceBuckets['90-94%']++
      else if (confidence >= 85) confidenceBuckets['85-89%']++
      else if (confidence >= 80) confidenceBuckets['80-84%']++
      else if (confidence >= 75) confidenceBuckets['75-79%']++
      else confidenceBuckets['70-74%']++
    })

    Object.entries(confidenceBuckets).forEach(([bucket, count]) => {
      if (count > 0) {
        console.log(`  ${bucket}: ${count} matches`)
      }
    })
  }

  // Show unmatched details
  if (unmatchedRows.length > 0) {
    console.log('\n⚠️  UNMATCHED APPOINTMENTS (first 20):')
    console.log('These need manual review or data correction:\n')
    unmatchedRows.slice(0, 20).forEach(({ row }) => {
      console.log(`  ${row.ApptDate} | ${row.Practitioner} | ${row.LastName} | ${row.Service}`)
    })

    // Analyze unmatched patterns
    const unmatchedByPractitioner: Record<string, number> = {}
    unmatchedRows.forEach(({ row }) => {
      unmatchedByPractitioner[row.Practitioner] = (unmatchedByPractitioner[row.Practitioner] || 0) + 1
    })

    console.log('\n📊 UNMATCHED BY PRACTITIONER:')
    Object.entries(unmatchedByPractitioner)
      .sort(([, a], [, b]) => b - a)
      .forEach(([practitioner, count]) => {
        console.log(`  ${practitioner}: ${count} unmatched`)
      })
  }

  // Export unmatched for manual review
  if (unmatchedRows.length > 0) {
    const unmatchedCSV = [
      'ApptDate,Practitioner,LastName,Service,Payer,Reason',
      ...unmatchedRows.map(({ row, reason }) =>
        `"${row.ApptDate}","${row.Practitioner}","${row.LastName}","${row.Service}","${row.Payer || ''}","${reason}"`
      )
    ].join('\n')

    const outputPath = '/tmp/unmatched-appointments.csv'
    fs.writeFileSync(outputPath, unmatchedCSV)
    console.log(`\n📄 Unmatched appointments exported to: ${outputPath}`)
  }

  console.log('\n✨ Import complete!')
}

main().catch(console.error)
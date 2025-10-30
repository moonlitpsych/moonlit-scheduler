#!/usr/bin/env tsx
/**
 * Import finance data from Moonlit P&L CSV into database
 *
 * Usage: npx tsx scripts/import-finance-data.ts
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
}

async function main() {
  console.log('🔍 Reading CSV file...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CSVRow[]

  console.log(`📊 Found ${records.length} appointments in CSV`)

  // First, fetch all appointments from the database
  console.log('\n🔍 Fetching appointments from database...')
  const response = await fetch(`${API_BASE}/api/finance/appointments?limit=1000`)
  const result = await response.json()

  if (!result.success) {
    throw new Error(`Failed to fetch appointments: ${result.error}`)
  }

  const dbAppointments = result.data || []
  console.log(`📊 Found ${dbAppointments.length} appointments in database`)

  let matched = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  const noMatchReasons: Record<string, number> = {}

  // Helper function to normalize practitioner names
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^dr\.?\s+/i, '') // Remove "Dr." or "Dr"
      .replace(/,?\s*(md|do|phd|np|pa-c)\.?$/i, '') // Remove titles at end
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  // Helper function to check if names match (handles "First Last" vs "Last, First" formats)
  const namesMatch = (csvName: string, dbName: string): boolean => {
    const csvNorm = normalizeName(csvName)
    const dbNorm = normalizeName(dbName)

    // Direct match
    if (dbNorm.includes(csvNorm) || csvNorm.includes(dbNorm)) {
      return true
    }

    // Check if all parts of CSV name appear in DB name
    const csvParts = csvNorm.split(' ')
    const allPartsMatch = csvParts.every(part =>
      part.length > 0 && dbNorm.includes(part)
    )

    return allPartsMatch
  }

  for (const row of records) {
    // Skip test appointments
    if (row.LastName === 'Test') {
      skipped++
      continue
    }

    // Parse date from M/D/YYYY to YYYY-MM-DD
    const dateParts = row.ApptDate.split('/')
    const apptDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`

    // Find matching appointment in database with improved logic
    const match = dbAppointments.find((appt: any) => {
      const dateMatches = appt.appt_date === apptDate
      const practitionerMatches = namesMatch(row.Practitioner, appt.practitioner || '')
      const lastNameMatches = (appt.last_name || '').toLowerCase() === row.LastName.toLowerCase()

      return dateMatches && practitionerMatches && lastNameMatches
    })

    if (!match) {
      // Better logging with reason
      const reason = `${apptDate} ${row.Practitioner} ${row.LastName}`
      noMatchReasons[reason] = (noMatchReasons[reason] || 0) + 1
      console.log(`⚠️  No match for: ${reason}`)
      skipped++
      continue
    }

    matched++

    // Prepare the updates
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
    if (row.ProviderPaidDate) {
      const dateParts = row.ProviderPaidDate.split('/')
      const paidDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`
      updates.push({
        column: 'provider_paid_date',
        value: paidDate,
        label: `Paid Date: ${row.ProviderPaidDate}`
      })
    }

    // Column T: ClaimStatus
    if (row.ClaimStatus && row.ClaimStatus !== 'not needed') {
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
    console.log(`\n✏️  Updating ${apptDate} ${row.Practitioner} ${row.LastName}:`)

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
              reason: 'CSV import from Moonlit P&L spreadsheet',
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

    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary:')
  console.log('='.repeat(60))
  console.log(`Total CSV rows:     ${records.length}`)
  console.log(`Matched in DB:      ${matched}`)
  console.log(`Fields updated:     ${updated}`)
  console.log(`Skipped:            ${skipped}`)
  console.log(`Errors:             ${errors}`)
  console.log('='.repeat(60))

  if (Object.keys(noMatchReasons).length > 0) {
    console.log('\n⚠️  Appointments with no match (first 20):')
    Object.entries(noMatchReasons)
      .slice(0, 20)
      .forEach(([reason, count]) => {
        console.log(`  ${reason} (${count} occurrence${count > 1 ? 's' : ''})`)
      })
  }
}

main().catch(console.error)

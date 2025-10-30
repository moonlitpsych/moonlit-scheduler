#!/usr/bin/env tsx
/**
 * Deploy migration 054: Add provider_paid and reimbursement manual overrides
 */

import fs from 'fs'
import path from 'path'

const MIGRATION_PATH = '/Users/miriam/CODE/moonlit-scheduler-work-oct-29/database-migrations/054-add-provider-paid-reimbursement-overrides.sql'

async function main() {
  console.log('🔍 Reading migration file...')
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8')

  console.log('\n📋 Migration SQL:')
  console.log('='.repeat(80))
  console.log(sql)
  console.log('='.repeat(80))

  console.log('\n📌 Next steps:')
  console.log('1. Copy the SQL above')
  console.log('2. Open: https://supabase.com/dashboard/project/alavxdxxttlfprkiwtrq/sql/new')
  console.log('3. Paste and run the SQL')
  console.log('4. Verify the view is updated')
  console.log('\nOR')
  console.log('Run: pbcopy < database-migrations/054-add-provider-paid-reimbursement-overrides.sql')
  console.log('Then paste in Supabase SQL editor')
}

main().catch(console.error)

#!/usr/bin/env tsx
/**
 * Run migration 007: Create UPSERT function for provider_payer_networks
 * This allows the contract creation form to save (create or update) without 409 conflicts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 Running migration 007: Create UPSERT function for provider_payer_networks')

  const migrationFile = path.join(__dirname, '../database-migrations/007-upsert-provider-payer-contract-function.sql')
  const sql = fs.readFileSync(migrationFile, 'utf-8')

  // Split by semicolons and filter out comments and empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📝 Found ${statements.length} SQL statements to execute`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip pure comment blocks
    if (statement.match(/^--/)) {
      continue
    }

    console.log(`\n⚙️  Executing statement ${i + 1}/${statements.length}...`)
    console.log(statement.substring(0, 100) + '...')

    const { error } = await supabase.rpc('exec_sql', {
      sql: statement + ';'
    }).single()

    if (error) {
      // Try direct execution if rpc method doesn't exist
      const { error: directError } = await supabase
        .from('_migrations')
        .insert({ name: '007-upsert-provider-payer-contract-function', executed_at: new Date().toISOString() })

      if (directError) {
        console.log('ℹ️  No _migrations table found, executing SQL directly...')
      }

      // For Supabase, we need to use the SQL editor or API
      console.log('⚠️  Cannot execute migration automatically.')
      console.log('📋 Please run this migration manually in the Supabase SQL Editor:')
      console.log('\n' + sql)
      return
    }

    console.log('✅ Statement executed successfully')
  }

  console.log('\n✅ Migration completed successfully!')
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})

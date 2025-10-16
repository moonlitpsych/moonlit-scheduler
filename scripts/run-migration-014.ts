/**
 * Migration Runner: 014-v3-partner-dashboard-schema.sql
 * Run with: npx tsx scripts/run-migration-014.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function runMigration() {
  console.log('🚀 Starting migration 014: Partner Dashboard V3.0 Schema')
  console.log('📍 Database:', supabaseUrl)
  console.log('')

  // Read the migration file
  const migrationPath = path.join(__dirname, '../database-migrations/014-v3-partner-dashboard-schema.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📄 Migration file loaded')
  console.log('📝 SQL length:', migrationSQL.length, 'characters')
  console.log('')

  try {
    // Execute the migration
    console.log('⏳ Executing migration...')

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    })

    if (error) {
      // If exec_sql function doesn't exist, try direct query
      console.log('⚠️  exec_sql RPC not available, trying direct query...')

      // Split into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        if (stmt.length === 0) continue

        console.log(`  Executing statement ${i + 1}/${statements.length}...`)

        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: stmt })

        if (stmtError) {
          console.error(`  ❌ Error in statement ${i + 1}:`, stmtError.message)
          throw stmtError
        }
      }

      console.log('✅ Migration completed successfully!')
    } else {
      console.log('✅ Migration completed successfully!')
      if (data) {
        console.log('📊 Result:', data)
      }
    }

    console.log('')
    console.log('🎉 Migration 014 complete!')
    console.log('')
    console.log('📋 What was created:')
    console.log('  ✓ partner_users table')
    console.log('  ✓ Updated patient_organization_affiliations')
    console.log('  ✓ Updated patients (referral tracking)')
    console.log('  ✓ Updated organizations (BAA tracking)')
    console.log('  ✓ partner_user_patient_assignments table')
    console.log('  ✓ patient_activity_log table')
    console.log('  ✓ Views: v_active_partner_users, v_partner_user_patients')
    console.log('  ✓ Sample data: Beth Whipey (FSH)')
    console.log('')

  } catch (err: any) {
    console.error('❌ Migration failed:', err.message)
    console.error('')
    console.error('Stack trace:', err.stack)
    process.exit(1)
  }
}

runMigration()
